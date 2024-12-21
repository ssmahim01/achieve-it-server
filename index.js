const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const port = process.env.PORT || 5000;
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://auth-connections.web.app",
      "https://achieve-it.surge.sh"
      ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  // console.log(token);

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  jwt.verify(token, process.env.SECRET_ACCESS_JWT, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access" });
    }

    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.ybs8l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // await client.connect();
    // // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    const courseCollection = client.db("coursesDB").collection("courses");
    const bidCollection = client.db("coursesDB").collection("bids");

    app.get("/courses", async (req, res) => {
      const findAll = courseCollection.find();
      const result = await findAll.toArray();
      res.send(result);
    });

    app.get("/course/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.findOne(query);
      res.send(result);
    });

    app.get("/courses/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const decoded = req.user?.email;

      if (email !== decoded) {
        return res.status(401).send({ message: "Unauthorized access" });
      }

      let query = { "poster.email": email };

      const result = await courseCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/all-courses", async (req, res) => {
      const filter = req.query.filter;
      const search = req.query.search;
      const sort = req.query.sort;

      let query = {};
      let options = {};

      if (filter) {
        query.category = filter;
      }

      if (search) {
        query = { course_title: { $regex: search, $options: "i" } };
      }

      if (sort) {
        options = { sort: { deadline: sort === "asc" ? 1 : -1 } };
      }

      const findResult = await courseCollection.find(query, options).toArray();
      res.send(findResult);
    });

    app.post("/jwt-access", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_ACCESS_JWT, {
        expiresIn: "1d",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true });
    });

    app.post("/log-out", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true });
    });

    app.post("/add-course", async (req, res) => {
      const newCourse = req.body;
      const result = await courseCollection.insertOne(newCourse);
      // console.log(result);
      res.send(result);
    });

    app.delete("/course/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const deleteResult = await courseCollection.deleteOne(query);
      res.send(deleteResult);
    });

    app.put("/update-course/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const courseData = req.body;

      const options = { upsert: true };
      const updateData = {
        $set: courseData,
      };

      const updateResult = await courseCollection.updateOne(
        query,
        updateData,
        options
      );

      res.send(updateResult);
    });

    // Bids related APIs

    app.get("/bids", verifyToken, async (req, res) => {
      const poster = req.query.posterEmail;
      const userEmail = req.user?.email;

      if (poster !== userEmail) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }

      let query = {};

      if (poster) {
        query.posterEmail = poster;
      }

      const result = await bidCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/my-bids/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const userEmail = req.user?.email;
      let query = { email };

      if (email !== userEmail) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }

      const result = await bidCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/add-bid", async (req, res) => {
      const bid = req.body;
      const insertResult = await bidCollection.insertOne(bid);

      const id = bid.courseId;
      const query = { _id: new ObjectId(id) };

      const course = await courseCollection.findOne(query);
      let newCount = 0;

      if (course?.bidCount) {
        newCount = course.bidCount + 1;
      } else {
        newCount = 1;
      }

      const filter = { _id: new ObjectId(id) };
      const updatedCount = { $set: { bidCount: newCount } };
      const updateResult = await courseCollection.updateOne(
        filter,
        updatedCount
      );

      res.send(insertResult);
    });

    app.patch("/bid-status/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };

      const statusUpdate = {
        $set: { status },
      };

      const updateResult = await bidCollection.updateOne(filter, statusUpdate);
      res.send(updateResult);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Achieve IT Server....");
});

app.listen(port, () => console.log(`Server running on port ${port}`));
