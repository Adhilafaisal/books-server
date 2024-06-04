require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const bsServer = express();
const verifyToken = require("./middleware/verifyToken");
const verifyAdmin = require("./middleware/verifyAdmin");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

//middleware
bsServer.use(cors());
bsServer.use(express.json());

const PORT = process.env.PORT || 3000;
const mongoose = require("mongoose");

bsServer.listen(PORT, () => {
  console.log(`Server is running at:${PORT}`);
});

bsServer.get("/", (req, res) => {
  res.status(200).send("The get request hit successfully");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ipxlzy1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //create collection of documents
    const booksCollections = client.db("BookInventory").collection("books");
    const cartCollections = client.db("BookInventory").collection("cartItems");
    const usersCollections = client.db("BookInventory").collection("users");
    const paymentsCollections = client.db("BookInventory").collection("payments");

    //stripe payment routes
    // Create a PaymentIntent with the order amount and currency
    bsServer.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount=price*100;

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });


    //post payment info to db
    // bsServer.post("/payments",verifyToken, async (req, res) => {
    //   const payment = req.body;
    //   try{
    //     const result = await paymentsCollections.insertOne(payment);
    //     //delete cart after payment
    //     const query = { _id: ObjectId(payment.cart) };
    //     const result2 = await cartCollections.deleteOne(query);

    //     res.status(200).json(result,result2);
    //   }
    //   catch(error){ 
    //    res.status(404).json({message: error.message});
    //   }
    // });

   

bsServer.post("/payments", verifyToken, async (req, res) => {
    const payment = req.body;
    try {
        // Insert payment into the payments collection
        const insertResult = await paymentsCollections.insertOne(payment);
        
        // Delete cart after payment
        const query = { _id: ObjectId(payment.cart) };
        const deleteResult = await cartCollections.deleteOne(query);
        
        // Respond with both results
        res.status(200).json({
            paymentResult: insertResult,
            cartDeletionResult: deleteResult
        });
    } catch (error) {
        // Handle errors appropriately
        res.status(500).json({ message: error.message });
    }
});
        














    //get all users
    bsServer.get("/users", async (req, res) => {
      try {
        const result = await usersCollections.find({}).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error processing request", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //post a new user
    bsServer.post("/users", async (req, res) => {
      try {
        const data = req.body;
        const query = { email: data.email }; // Assuming 'email' is the unique identifier for users

        // Check if the user already exists
        const existingUser = await usersCollections.findOne(query);

        if (existingUser) {
          return res.status(409).send("User already exists");
        }

        // If the user doesn't exist, insert the new user
        const result = await usersCollections.insertOne(data);
        res.send(result);
      } catch (error) {
        console.error("Error processing request", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //delete a user
    bsServer.delete("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;

        // Check if the id is a valid ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).send("Invalid ID format");
        }

        const filter = { _id: new ObjectId(id) };
        const result = await usersCollections.deleteOne(filter);

        if (result.deletedCount === 0) {
          return res.status(404).send("User not found");
        }

        res.send({ message: "User deleted successfully" });
      } catch (error) {
        console.error("Error processing request", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //jwt authentication
    bsServer.post("/jwt", async (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res.send({ token });
    });

    //existing cart item

    bsServer.post("/cart", async (req, res) => {
      const data = req.body;
      const { email, bookItemId, quantity } = data;

      if (!email || !bookItemId || !quantity) {
        return res.status(400).send("Missing email, bookItemId, or quantity");
      }

      try {
        const existingCartItem = await cartCollections.findOne({
          email: email,
          bookItemId: bookItemId,
        });

        let result;
        if (existingCartItem) {
          // Update the quantity if the book already exists
          result = await cartCollections.updateOne(
            { email: email, bookItemId: bookItemId },
            { $inc: { quantity: quantity } }
          );
        } else {
          // Insert the new book into the cart
          result = await cartCollections.insertOne(data);
        }

        res.send(result);
      } catch (error) {
        console.error("Error processing request", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //search a book

    bsServer.get("/search", async (req, res) => {
      const searchTerm = req.query.q;
      if (!searchTerm) {
        return res.status(400).send("Missing search term");
      }

      try {
        const results = await booksCollections
          .find({ bookTitle: { $regex: searchTerm, $options: "i" } })
          .toArray();
        res.send(results);
      } catch (error) {
        console.error("Error processing search request", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //insert a book to the database
    bsServer.post("/upload-books", async (req, res) => {
      const data = req.body;

      const result = await booksCollections.insertOne(data);
      res.send(result);
    });

    //get carts using email
    bsServer.get("/cart", verifyToken, async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const result = await cartCollections.find(filter).toArray();
      res.send(result);
    });

    //get specific cart
    bsServer.get("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await cartCollections.findOne(filter);
      res.send(result);
    });

    //delete items from cart
    bsServer.delete("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await cartCollections.deleteOne(filter);
      res.send(result);
    });

    //update items from cart
    bsServer.patch("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const updateItem = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...updateItem,
        },
      };
      const result = await cartCollections.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    //update a book data: patch or update methods
    bsServer.patch("/book/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id)
      const updateBookData = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };

      const updateDoc = {
        $set: {
          ...updateBookData,
        },
      };
      //update
      const result = await booksCollections.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    //delete a book data
    bsServer.delete("/book/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await booksCollections.deleteOne(filter);
      res.send(result);
    });

    //find by category
    bsServer.get("/all-books", async (req, res) => {
      let query = {};
      if (req.query?.category) {
        query = { category: req.query.category };
      }
      const result = await booksCollections.find(query).toArray();
      res.send(result);
    });

    //to get single book data
    bsServer.get("/book/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await booksCollections.findOne(filter);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
