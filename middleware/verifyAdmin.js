const jwt = require("jsonwebtoken");

const verifyAdmin =async (req, res, next) => {
    const email=req.decoded.email;
    const query = { email: email };
    const user = await usersCollections.findOne(query);

    if (user?.role !== "admin") {   
        return res.status(403).send({ message: "Forbidden access" });
    }
    next();
    
};

module.exports = verifyAdmin;
