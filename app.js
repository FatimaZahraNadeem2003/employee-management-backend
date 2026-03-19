require("express-async-errors");
require("dotenv").config({ path: "./.env" });

const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'JWT_LIFETIME', 'PORT'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const app = express();

const helmet = require("helmet");
const xss = require("xss-clean");
const rateLimiter = require("express-rate-limit");

const connectDB = require("./db/connect");

const authRouter = require('./routes/auth');
const userRouter = require('./routes/user');
const notFoundMiddleware = require('./middleware/not-found');
const errorHandlerMiddleware = require('./middleware/error-handler');


app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);
app.use(helmet());
app.use(cors());
app.use(xss());
app.use(express.json());

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    msg: "API working",
  });
});

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 3000;

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    app.listen(port, () =>
      console.log(`Server is listening on port ${port}...`)
    );
  } catch (error) {
    console.log(error);
  }
};

start();