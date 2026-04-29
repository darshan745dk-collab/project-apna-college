if(process.env.NODE_ENV !== "production"){
  require("dotenv").config();
}

const express = require("express");
const app = express();
const dns = require("dns");
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapasync.js");
const ExpressError = require("./utils/expresserrors.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const Review = require("./models/review.js");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;

const flash = require("connect-flash");
const passport = require("passport");
const LocalStratergy = require("passport-local");
const User = require("./models/user.js");


const listingRouter = require("./routes/listing.js");
const reviewsRouter = require ("./routes/review.js");
const userRouter = require ("./routes/user.js");


// const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";
const isAtlas = /^mongodb\+srv:\/\//.test(dbUrl);

let store; // Declare store variable

// Database connection and setup
async function connectDB() {
  try {
    await mongoose.connect(dbUrl, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("Connected to DB");

    // Create session store after successful DB connection
    store = MongoStore.create({
      client: mongoose.connection.getClient(),
      crypto: {
        secret: process.env.SECRET,
      },
      touchAfter: 24 * 60 * 60, // time period in seconds
    });

    store.on("error", (err) =>{
      console.log("Session store error", err);
    });

    // Set up session middleware
    app.use(session({
      store,
      secret: process.env.SECRET,
      resave: false,
      saveUninitialized: true,
      cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 1 week
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }));

    console.log("Session store configured");
  } catch (err) {
    console.error("Database connection failed:", err.message);
    console.log("Falling back to local MongoDB...");

    try {
      // Try local MongoDB as fallback
      const localUrl = "mongodb://127.0.0.1:27017/wanderlust";
      await mongoose.connect(localUrl, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log("Connected to local MongoDB");

      // Create session store with local connection
      store = MongoStore.create({
        client: mongoose.connection.getClient(),
        crypto: {
          secret: process.env.SECRET,
        },
        touchAfter: 24 * 60 * 60, // time period in seconds
      });

      store.on("error", (err) =>{
        console.log("Session store error", err);
      });

      // Set up session middleware
      app.use(session({
        store,
        secret: process.env.SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: {
          httpOnly: true,
          expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 1 week
          maxAge: 1000 * 60 * 60 * 24 * 7,
        },
      }));

      console.log("Session store configured with local MongoDB");
    } catch (localErr) {
      console.error("Local MongoDB connection also failed:", localErr.message);
      console.log("Please ensure MongoDB is running locally or check your Atlas network access.");
      process.exit(1);
    }
  }
}

// Initialize database connection
connectDB();
passport.deserializeUser(User.deserializeUser());


app.use((req,res,next) =>{
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/", userRouter);



app.use((req,res,next) =>{
  next(new ExpressError (404, "Page Not Found"));
});

app.use((err, req, res ,next) =>{
  let {statusCode = 500, message= "Something went wrong"} = err;
  res.status(statusCode).render("error.ejs", { message });
});

app.listen(8080, () => {
  console.log("server is listening to port 8080");
});