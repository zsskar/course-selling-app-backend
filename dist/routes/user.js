"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = express_1.default.Router();
router.post("/signup", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { firstName, lastName, email, password } = req.body;
    const user = yield db_1.User.findOne({ email });
    if (user) {
        res.status(403).json({ message: "User already exists" });
    }
    else {
        const newUser = new db_1.User({
            firstName,
            lastName,
            email,
            password,
            role: "user",
        });
        yield newUser.save();
        const token = jsonwebtoken_1.default.sign({ email, role: "user" }, auth_1.SECRET, {
            expiresIn: "1h",
        });
        res.json({ message: "User created successfully", token });
    }
}));
router.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    try {
        const user = yield db_1.User.findOne({ email, password })
            .populate({
            path: "purchasedCourses.course",
            select: "title description price imageLink status category discount published syllabus publishDate purchaseDate",
        })
            .exec();
        if (user) {
            const token = jsonwebtoken_1.default.sign({ email, role: user.role || "user" }, auth_1.SECRET, {
                expiresIn: "1h",
            });
            user.lastLogin = new Date();
            user.save();
            res.json({
                user,
                message: "Logged in successfully",
                token,
                tokenTime: 3600,
            });
        }
        else {
            res.status(403).json({ message: "Invalid email or password" });
        }
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
}));
router.get("/filterCourses", auth_1.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const email = req.headers.email; // Ensure email is properly typed
    try {
        // Find the user by email and populate the purchasedCourses field
        const user = yield db_1.User.findOne({ email })
            .populate({
            path: "purchasedCourses.course",
            select: "title description price imageLink status category discount published syllabus publishDate purchaseDate",
        })
            .exec();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // Extract purchased course IDs, checking for null or undefined
        const purchasedCourseIds = user.purchasedCourses
            .map((course) => { var _a; return (_a = course.course) === null || _a === void 0 ? void 0 : _a._id; }) // Use optional chaining
            .filter((id) => id !== undefined); // Remove undefined values
        // Find courses that are published and not in the user's purchased list
        const courses = yield db_1.Course.find({
            published: true,
            _id: { $nin: purchasedCourseIds },
        })
            .sort({ publishDate: -1 })
            .exec();
        res.json({ courses });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
}));
router.get("/courses", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const courses = yield db_1.Course.find({ published: true })
        .sort({ publishDate: -1 })
        .exec();
    res.json({ courses });
}));
router.post("/courses/:courseId", auth_1.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const courseId = req.params.courseId;
    const email = req.headers.email; // Ensure email is properly typed
    try {
        // Find the course by ID
        const course = yield db_1.Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }
        if (!email) {
            return res.status(400).json({ message: "Email header is missing" });
        }
        // Find the user by email
        const user = yield db_1.User.findOne({ email });
        if (!user) {
            return res.status(403).json({ message: "User not found" });
        }
        // Check if the course is already purchased
        const alreadyPurchased = user.purchasedCourses.some((purchasedCourse) => { var _a; return ((_a = purchasedCourse.course) === null || _a === void 0 ? void 0 : _a.toString()) === courseId; });
        if (alreadyPurchased) {
            return res.status(400).json({ message: "Course already purchased" });
        }
        // Add the course to the user's purchasedCourses array with the purchase date
        user.purchasedCourses.push({
            course: course._id,
            purchasedDate: new Date(), // Set the purchase date to now
        });
        yield user.save();
        res.json({ message: "Course purchased successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
}));
router.get("/purchasedCourses", auth_1.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const email = req.headers.email; // Ensure email is properly typed
    try {
        if (!email) {
            return res.status(400).json({ message: "Email header is missing" });
        }
        // Find the user by email and populate the purchasedCourses field
        const user = yield db_1.User.findOne({ email })
            .populate({
            path: "purchasedCourses.course",
            select: "title description price imageLink status category discount published syllabus publishDate purchaseDate",
        })
            .exec();
        if (user) {
            // Ensure course data is available and properly formatted
            const courses = user.purchasedCourses
                .filter((purchasedCourse) => purchasedCourse.course != null) // Filter out null or undefined courses
                .map((purchasedCourse) => (Object.assign(Object.assign({}, purchasedCourse.course._doc), { purchasedDate: purchasedCourse.purchasedDate })));
            res.json({ courses });
        }
        else {
            res.status(403).json({ message: "User not found" });
        }
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
}));
router.get("/dashboard/getAnalytics", auth_1.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userEmail = req.headers.email;
    try {
        if (!userEmail) {
            return res.status(400).json({ message: "Email header is missing" });
        }
        // Find the user by email and populate purchasedCourses with course details
        const user = yield db_1.User.findOne({ email: userEmail })
            .populate("purchasedCourses.course")
            .exec();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // Ensure purchasedCourses is populated with course documents
        const purchasedCourses = user.purchasedCourses
            .map((purchasedCourse) => purchasedCourse.course)
            .filter((course) => course != null);
        // Calculate the total purchased courses amount
        const totalPurchasedCoursesAmount = purchasedCourses.reduce((acc, course) => acc +
            ((course === null || course === void 0 ? void 0 : course.discount) == 0
                ? course === null || course === void 0 ? void 0 : course.price
                : (course === null || course === void 0 ? void 0 : course.price) - ((course === null || course === void 0 ? void 0 : course.price) * (course === null || course === void 0 ? void 0 : course.discount)) / 100), 0);
        // Get the count of purchased courses
        const purchasedCoursesCount = purchasedCourses.length;
        // Count the total refund requests for the user
        const userRefundRequestsData = yield db_1.RefundRequests.aggregate([
            { $match: { email: userEmail } },
            { $unwind: "$refundRequests" },
            { $count: "totalRefundRequests" },
        ]);
        const totalRefundRequests = userRefundRequestsData.length > 0
            ? userRefundRequestsData[0].totalRefundRequests
            : 0;
        // Construct the dashboard object
        const dashboard = {
            purchasedCoursesCount,
            totalPurchasedCoursesAmount,
            totalRefundRequests,
        };
        res.json({ dashboard });
    }
    catch (error) {
        // console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}));
router.post("/makeRefundRequest", auth_1.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { course } = req.body;
    const email = req.headers.email;
    if (!course || !email) {
        return res.status(400).json({ message: "Course and email are required" });
    }
    try {
        // Check if the course and user exist
        const user = yield db_1.User.findOne({ email });
        const courseExists = yield db_1.Course.findById(course);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!courseExists) {
            return res.status(404).json({ message: "Course not found" });
        }
        // console.log(user);
        // Find the purchased date for the course from the user's purchasedCourses
        const purchasedCourse = user.purchasedCourses.find((pc) => pc.course != null && pc.course.toString() === course._id.toString());
        // console.log("purchasedCourse: ", purchasedCourse);
        if (!purchasedCourse) {
            return res
                .status(404)
                .json({ message: "Course not purchased by the user" });
        }
        // Find or create a refund request document for the user
        let refundRequest = yield db_1.RefundRequests.findOne({ email });
        if (!refundRequest) {
            refundRequest = new db_1.RefundRequests({ email, refundRequests: [] });
        }
        // Check if a refund request for the same course already exists
        const existingRequest = refundRequest.refundRequests.find((request) => request.course && request.course.toString() === course);
        if (existingRequest) {
            return res.status(400).json({
                refund: existingRequest,
                message: "Refund request for this course already exists",
            });
        }
        // Add the new refund request with purchasedDate
        refundRequest.refundRequests.push({
            course,
            purchasedDate: purchasedCourse.purchasedDate,
        });
        const savedRequest = yield refundRequest.save();
        res.json({
            refund: savedRequest,
            message: "Refund request made successfully",
        });
    }
    catch (error) {
        // console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}));
router.get("/getRefundRequests", auth_1.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const email = req.headers.email;
    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }
    try {
        const refundRequest = yield db_1.RefundRequests.findOne({ email }).populate("refundRequests.course");
        if (!refundRequest) {
            return res.json({ message: "No refund requests found for this email" });
        }
        res.json({ refundRequests: refundRequest.refundRequests });
    }
    catch (error) {
        // console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}));
router.post("/checkEmail", auth_1.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    try {
        if (!email) {
            return res.status(400).json({ message: "email is required." });
        }
        const user = yield db_1.User.findOne({ email: email });
        const admin = yield db_1.Admin.findOne({ email: email });
        if (user || admin) {
            res.json({ message: "F", user });
        }
        else {
            res.json({ message: "NF", email });
        }
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error." });
    }
}));
router.put("/updateAccount/:userId", auth_1.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const updateFields = {
            firstName: req.body.user.firstName,
            lastName: req.body.user.lastName,
            email: req.body.user.email,
            password: req.body.user.password,
        };
        if (req.body.user.role && req.body.user.role === "user") {
            const user = yield db_1.User.findByIdAndUpdate(req.params.userId, { $set: updateFields }, // $set ensures only specified fields are updated
            {
                new: true,
                runValidators: true,
            });
            if (user) {
                res.json({ message: "User updated successfully", user });
            }
            else {
                res.status(404).json({ message: "User not found" });
            }
        }
        else {
            const user = yield db_1.Admin.findByIdAndUpdate(req.params.userId, { $set: updateFields }, // $set ensures only specified fields are updated
            {
                new: true,
                runValidators: true,
            });
            if (user) {
                res.json({ message: "User updated successfully", user });
            }
            else {
                res.status(404).json({ message: "User not found" });
            }
        }
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error." });
    }
}));
exports.default = router;
