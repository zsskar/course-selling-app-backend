"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundRequests = exports.DeviceLog = exports.Course = exports.Admin = exports.User = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const name = {
    firstName: String,
    lastName: String,
    role: { type: String, required: false },
};
const userSchema = new mongoose_1.default.Schema(Object.assign(Object.assign({}, name), { email: String, password: String, createdDate: { type: Date, default: Date.now }, lastLogin: { type: Date, default: Date.now }, loginCount: { type: Number, required: false, default: 0 }, maxLoginDevices: { type: Number, default: 2, required: false }, purchasedCourses: [
        {
            course: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Course" },
            purchasedDate: { type: Date, default: Date.now }, // Add the purchaseDate field
        },
    ] }));
const refundRequestSchema = new mongoose_1.default.Schema({
    email: String,
    refundRequests: [
        {
            course: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Course" },
            requestDate: { type: Date, default: Date.now },
            status: { type: String, default: "pending" },
            purchasedDate: { type: Date },
        },
    ],
});
const adminSchema = new mongoose_1.default.Schema(Object.assign(Object.assign({}, name), { email: String, password: String }));
const courseSchema = new mongoose_1.default.Schema({
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
const deviceLogSchema = new mongoose_1.default.Schema({
    deviceType: { type: String, required: true },
    date: { type: Date, required: true },
    count: { type: Number, default: 1 },
});
exports.User = mongoose_1.default.model("User", userSchema);
exports.Admin = mongoose_1.default.model("Admin", adminSchema);
exports.Course = mongoose_1.default.model("Course", courseSchema);
exports.DeviceLog = mongoose_1.default.model("DeviceLog", deviceLogSchema);
exports.RefundRequests = mongoose_1.default.model("RefundRequests", refundRequestSchema);
