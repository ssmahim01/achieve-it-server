const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const port = process.env.PORT || 5000;
const app = express();

app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if(!token){
    return res.status(401).send({message: "Unauthorized access"})
  }

  jwt.verify(token, process.env.SECRET_ACCESS_JWT, (err, decoded) => {
    if(err){
      return res.status(401).send({message: "Unauthorized access"})
    }

    req.user = decoded;
    next();
  })
};

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.ybs8l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const courseCollection = client.db("coursesDB").collection("courses");

    app.get("/courses", async(req, res) => {
        const findAll = courseCollection.find();
        const result = await findAll.toArray();
        res.send(result);
    });

    app.post("/jwt-access", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_ACCESS_JWT, {expiresIn: '2h'});

      res.cookie('token', token, {
        httpOnly: true,
        secure: false
      })
      .send({success: true})
    });

    app.post("/log-out", (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: false
      })
      .send({success: true})
    });

    app.post("/add-course", async(req, res) => {
        const newCourse = req.body;
        const result = await courseCollection.insertOne(newCourse);
        console.log(result);
        res.send(result);
    });

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello from Achieve IT Server....');
});

app.listen(port, () => console.log(`Server running on port ${port}`));