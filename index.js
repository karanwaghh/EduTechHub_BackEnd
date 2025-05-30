
const express = require("express");
const app = express();

const userRoutes = require("./routes/User");
const profileRoutes = require("./routes/Profile");
const paymentRoutes = require("./routes/Payment");
const courseRoutes = require("./routes/Course");


const db = require("./config/database");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const cloud = require("./config/cloudinary");
const fileUpload = require("express-fileupload");
const dotenv = require("dotenv");


dotenv.config();
const PORT = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
    methods: ["POST", "GET"],
    credentials: true,
    optionSuccessStatus: 200,
  })
);
app.use(
    fileUpload({
        useTempFiles:true,
        tempFileDir:"/tmp",
    })
);

 
// Routes
app.use("/api/v1/auth", userRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/course", courseRoutes);

// database connect
db.connectDB();

// cloudinary connect
cloud.cloudinaryConnect();

// initiate the server
app.listen(PORT, () => {
    console.log(`Server is running at ${PORT}`);
});

// default route
app.get("/", (req, res) => {
    return res.json({
        success:true,
        message:"Your Server is up and Running...."
    });
});