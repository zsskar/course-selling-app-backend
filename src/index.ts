import express from "express";
import mongoose from "mongoose";
export const app = express();

const port = 9000;
import adminRoutes from "./routes/admin";
import userRoutes from "./routes/user";
import deviceRoutes from "./routes/devicelog";
import cors from "cors";

app.use(cors());
app.use(express.json());

app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/device-logs", deviceRoutes);

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

const connectWithRetry = () => {
  console.log("MongoDB connection with retry");
  mongoose
    .connect(
      "mongodb+srv://rashid11612612:JustTesting123@rashid-cluster.ftut18u.mongodb.net/",
      {
        dbName: "course_selling_app",
      }
    )
    .then(() => {
      console.log("MongoDB is connected");
    })
    .catch((err) => {
      console.error(
        "MongoDB connection unsuccessful, retry after 5 seconds. ",
        err
      );
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();
