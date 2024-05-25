require('dotenv').config()
const express=require("express")
const cors=require("cors")

const bsServer=express()

bsServer.use(cors())
bsServer.use(express.json())

const PORT=process.env.PORT||3000

bsServer.listen(PORT,()=>{
    console.log(`Server is running at:${PORT}`)
})

bsServer.get('/',(req,res)=>{
    res.status(200).send("The get request hit successfully")
})


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = "mongodb+srv://mern-book-store:mernbookstore@cluster0.ipxlzy1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //create collection of documents
    const booksCollections= client.db("BookInventory").collection("books")

    //insert a book to the database
    bsServer.post("/upload-books",async(req,res)=>{
        const data=req.body
       
        const result=await booksCollections.insertOne(data)
        res.send(result)
    })
    
    //get all books from the database
    // bsServer.get("/all-books",async(req,res)=>{
    //     const books=booksCollections.find()
    //     const result=await books.toArray()
    //     res.send(result)
    // })

    //update a book data: patch or update methods
    bsServer.patch("/book/:id",async(req,res)=>{
        const id=req.params.id
        // console.log(id)
        const updateBookData=req.body
        const filter={_id:new ObjectId(id)}
        const options={upsert:true}

        const updateDoc ={
            $set:{
                ...updateBookData
            }
        }
        //update
        const result=await booksCollections.updateOne(filter,updateDoc,options)
        res.send(result)

    })


    //delete a book data
    bsServer.delete("/book/:id",async(req,res)=>{
        const id=req.params.id
        const filter={_id:new ObjectId(id)}
        const result=await booksCollections.deleteOne(filter)
        res.send(result)
    })

    //find by category
    bsServer.get("/all-books",async(req,res)=>{
    let query={}
    if(req.query?.category){
        query={category:req.query.category}
    }
    const result =await booksCollections.find(query).toArray()
    res.send(result)
    })

    //to get single book data
    bsServer.get("/book/:id",async(req,res)=>{
      const id=req.params.id;
      const filter ={_id:new ObjectId(id)};
      const result= await booksCollections.findOne(filter)
      res.send(result)
    })
    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
