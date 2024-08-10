import mongoose from "mongoose";

export interface ICourse {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  price: number;
  imageLink: string;
  status: string;
  category: string[];
  discount: number;
  published: boolean;
  syllabus: string;
  publishDate: Date;
  purchaseDate?: Date; // Optional field
}

export interface IUser {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  role?: string;
  email: string;
  password: string;
  createdDate: Date;
  lastLogin: Date;
  loginCount: Number;
  maxLoginDevices: Number;
  purchasedCourses: {
    course: ICourse; // Updated to reflect full course object
    purchasedDate: Date; // Add the purchaseDate field
  }[];
}

const name = {
  firstName: String,
  lastName: String,
  role: { type: String, required: false },
};

const userSchema = new mongoose.Schema({
  ...name,
  email: String,
  password: String,
  createdDate: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
  loginCount: { type: Number, required: false, default: 0 }, // Optional field
  maxLoginDevices: { type: Number, default: 2, required: false }, // Optional field
  purchasedCourses: [
    {
      course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
      purchasedDate: { type: Date, default: Date.now }, // Add the purchaseDate field
    },
  ],
});

const refundRequestSchema = new mongoose.Schema({
  email: String,
  refundRequests: [
    {
      course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
      requestDate: { type: Date, default: Date.now },
      status: { type: String, default: "pending" },
      purchasedDate: { type: Date },
    },
  ],
});

const adminSchema = new mongoose.Schema({
  ...name,
  email: String,
  password: String,
});

const courseSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  imageLink: String,
  status: String,
  category: [String],
  discount: Number,
  published: Boolean,
  syllabus: String,
  publishDate: { type: Date, default: Date.now },
});

const deviceLogSchema = new mongoose.Schema({
  deviceType: { type: String, required: true },
  date: { type: Date, required: true },
  count: { type: Number, default: 1 },
});

export const User = mongoose.model("User", userSchema);
export const Admin = mongoose.model("Admin", adminSchema);
export const Course = mongoose.model("Course", courseSchema);
export const DeviceLog = mongoose.model("DeviceLog", deviceLogSchema);
export const RefundRequests = mongoose.model(
  "RefundRequests",
  refundRequestSchema
);
