const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@phr.wy7ryxx.mongodb.net/?retryWrites=true&w=majority`;

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
      const bookings = req.body;
      const result = await bookingsCollection.insertOne(bookings);
      res.send(result);
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
