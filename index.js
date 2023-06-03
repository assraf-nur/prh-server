const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@phr.wy7ryxx.mongodb.net/?retryWrites=true&w=majority`;

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.send(401).send("Unauthorized access");
  }
  const token = authHeader.split("")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.send(403).sen("Forbidden access");
    }
    req.decoded = decoded;
    next();
  });
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const appointmentOptionCollection = client.db("patientReportHub").collection("appointmentOption");
    const bookingsCollection = client.db("patientReportHub").collection("bookings");
    const usersCollection = client.db("patientReportHub").collection("users");

    // use aggregate to query multiple collection and then merge data
    app.get("/appointmentOptions", async (req, res) => {
      const date = req.query.date; // Extract the 'date' parameter from the query string
      const query = {}; // Set an empty query object to retrieve all appointment options
      const options = await appointmentOptionCollection.find(query).toArray(); // Retrieve all appointment options from the database
      const bookingQuery = { appointmentDate: date }; // Set the query to retrieve all bookings for the specified date
      const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray(); // Retrieve all bookings for the specified date from the database
      options.forEach((option) => {
        // Loop through each appointment option
        const optionBooked = alreadyBooked.filter((book) => book.treatment === option.name); // Filter the bookings to get all bookings for the current appointment option
        const bookedSlots = optionBooked.map((book) => book.slot); // Extract the time slots that have already been booked for the current appointment option
        const remainingSlots = option.slots.filter((slot) => !bookedSlots.includes(slot)); // Filter out the booked time slots from the current appointment option's slots
        option.slots = remainingSlots; // Update the appointment option's slots to include only the remaining slots
      });
      res.send(options); // Send the updated list of appointment options as the response to the client
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment,
      };

      const alreadyBooked = await bookingsCollection.find(query).toArray();
      if (alreadyBooked.length) {
        const message = `You already have a booking on ${booking.appointmentDate}`;
        return res.send({ acknowledged: false, message });
      }

      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    // email wise booking list API
    app.get("/bookings", async (req, res) => {
      // Route handler for a GET request to "/bookings"
      const email = req.query.email;
      // Extracting the value of the "email" query parameter from the request
      const query = { email: email };
      // Creating a query object with the extracted email value
      const bookings = await bookingsCollection.find(query).toArray();
      // Performing a database query using the `find` method on the `bookingsCollection` collection,
      // passing in the query object. It retrieves all bookings that match the provided email.
      res.send(bookings);
      // Sending the retrieved bookings as the response to the client
    });

    // jwt function
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user && user.email) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: "1h" });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

    // serve all users
    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    // update user as admin
    app.put("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc, options);
      res.send(result);
    });

    // check admin or not
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    
  } finally {
  }
}

run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("doctor is running");
});

app.listen(port, () => {
  console.log("run doctor run");
});
