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
const db_1 = require("../db");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_1 = require("../middleware/auth");
const auth_2 = require("../middleware/auth");
const router = express_1.default.Router();
router.get("/me", auth_2.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.headers.email;
    if (!user) {
        return res.status(400).json({ msg: "User header is missing" });
    }
    else {
        const admin = yield db_1.Admin.findOne({ email: user });
        if (!admin) {
            res.status(403).json({ msg: "Admin doesnt exist" });
            return;
        }
        res.json({
            email: admin.email,
        });
    }
}));
router.post("/signup", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { firstName, lastName, email, password } = req.body;
    const admin = yield db_1.Admin.findOne({ email });
    if (admin) {
        res.status(403).json({ message: "Admin already exists" });
    }
    else {
        const adminObj = { firstName, lastName, email, password, role: "admin" };
        const newAdmin = new db_1.Admin(adminObj);
        newAdmin.save();
        const token = jsonwebtoken_1.default.sign({ email, role: "admin" }, auth_1.SECRET, {
            expiresIn: "1h",
        });
        res.json({ message: "Admin created successfully", token });
    }
}));
router.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    try {
        const admin = yield db_1.Admin.findOne({ email, password });
        if (admin) {
            const token = jsonwebtoken_1.default.sign({ email, role: "admin" }, auth_1.SECRET, {
                expiresIn: "1h",
            });
            res.json({
                user: admin,
                message: "Logged in successfully  ",
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
router.post("/courses", auth_2.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // console.log("Inside course creation", req.body);
        // Validate required fields
        // const {
        //   title,
        //   description,
        //   price,
        //   imageLink,
        //   status,
        //   discount,
        //   published,
        //   category,
        // } = req.body;
        // if (
        //   !title ||
        //   !description ||
        //   !price ||
        //   !imageLink ||
        //   !status ||
        //   discount === undefined ||
        //   published === undefined ||
        //   !category
        // ) {
        //   return res.status(400).json({ message: "All fields are required" });
        // }
        const course = new db_1.Course(req.body);
        yield course.save();
        res.json({ message: "Course created successfully", courseId: course._id });
    }
    catch (error) {
        console.error("Error creating course:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}));
router.put("/courses/:courseId", auth_2.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const course = yield db_1.Course.findByIdAndUpdate(req.params.courseId, req.body, {
        new: true,
    });
    if (course) {
        res.json({ message: "Course updated successfully" });
    }
    else {
        res.status(404).json({ message: "Course not found" });
    }
}));
router.get("/courses", auth_2.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const courses = yield db_1.Course.find({}).sort({ publishDate: -1 }).exec();
    res.json({ courses });
}));
router.get("/course/:courseId", auth_2.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const courseId = req.params.courseId;
    const course = yield db_1.Course.findById(courseId);
    if (course) {
        res.json({ course });
    }
    else {
        res.status(404).json({ message: "Course not found" });
    }
}));
router.get("/dashboard/getAnalytics", auth_2.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Total courses
        const totalCourses = yield db_1.Course.countDocuments({});
        // Published courses
        const publishedCourses = yield db_1.Course.countDocuments({ published: true });
        // Purchased courses
        const purchasedCourses = yield db_1.User.aggregate([
            { $unwind: "$purchasedCourses" },
            { $count: "totalPurchasedCourses" },
        ]);
        const totalPurchasedCourses = purchasedCourses.length > 0
            ? purchasedCourses[0].totalPurchasedCourses
            : 0;
        // Total students
        const totalStudents = yield db_1.User.countDocuments({
            "purchasedCourses.0": { $exists: true },
        });
        // Total Purchased Courses Amount
        const totalPurchasedCoursesAmountData = yield db_1.User.aggregate([
            { $unwind: "$purchasedCourses" },
            {
                $lookup: {
                    from: "courses",
                    localField: "purchasedCourses.course",
                    foreignField: "_id",
                    as: "courseDetails",
                },
            },
            { $unwind: "$courseDetails" },
            {
                $addFields: {
                    discountedPrice: {
                        $subtract: [
                            "$courseDetails.price",
                            {
                                $multiply: [
                                    "$courseDetails.price",
                                    { $divide: ["$courseDetails.discount", 100] },
                                ],
                            },
                        ],
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$discountedPrice" },
                },
            },
        ]);
        const totalPurchasedCoursesAmount = totalPurchasedCoursesAmountData.length > 0
            ? totalPurchasedCoursesAmountData[0].totalAmount
            : 0;
        // Total refund requests
        const totalRefundRequestsData = yield db_1.RefundRequests.aggregate([
            { $unwind: "$refundRequests" },
            { $count: "totalRefundRequests" },
        ]);
        const totalRefundRequests = totalRefundRequestsData.length > 0
            ? totalRefundRequestsData[0].totalRefundRequests
            : 0;
        // Construct the dashboard object
        const dashboard = {
            totalCourses,
            publishedCourses,
            purchasedCoursesCount: totalPurchasedCourses,
            totalStudents,
            totalPurchasedCoursesAmount,
            totalRefundRequests,
        };
        res.json({ dashboard });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}));
router.get("/getRefundRequests", auth_2.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Fetch all refund requests
        const refundRequests = yield db_1.RefundRequests.find({}).lean();
        // Create a response array
        const responseData = [];
        for (const refundRequest of refundRequests) {
            // Find the user by email
            const user = yield db_1.User.findOne({ email: refundRequest.email }).lean();
            if (user) {
                // Fetch course details for purchasedCourses
                const purchasedCourses = yield Promise.all(user.purchasedCourses.map((purchasedCourse) => __awaiter(void 0, void 0, void 0, function* () {
                    const course = yield db_1.Course.findById(purchasedCourse.course).lean();
                    return Object.assign(Object.assign({}, purchasedCourse), { courseDetails: course });
                })));
                // Map each refund request with course details and purchasedDate
                const enrichedRefundRequests = yield Promise.all(refundRequest.refundRequests.map((req) => __awaiter(void 0, void 0, void 0, function* () {
                    const course = yield db_1.Course.findById(req.course).lean();
                    const purchasedCourse = purchasedCourses.find((pc) => pc.course !== null &&
                        pc.course !== undefined &&
                        pc.course.toString() ===
                            (req.course !== null &&
                                req.course !== undefined &&
                                req.course.toString()));
                    return {
                        _id: req._id,
                        course: Object.assign(Object.assign({}, course), { purchasedDate: purchasedCourse
                                ? purchasedCourse.purchasedDate
                                : null }),
                        status: req.status,
                        requestDate: req.requestDate,
                    };
                })));
                // Add to response data
                responseData.push({
                    user: {
                        _id: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        role: user.role,
                        purchasedCourses: purchasedCourses.map((pc) => pc.courseDetails), // Include full course details in purchasedCourses
                    },
                    refundRequests: enrichedRefundRequests,
                });
            }
        }
        // Send response
        res.json({ requests: responseData });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}));
router.post("/approveOrRejectRefundRequest", auth_2.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userEmail, courseId, status } = req.body;
    try {
        if (!userEmail || !courseId || !status) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        // Find the refund request document by email
        const refundRequestDoc = yield db_1.RefundRequests.findOne({
            email: userEmail,
        });
        if (!refundRequestDoc) {
            return res
                .status(404)
                .json({ message: "Refund request document not found" });
        }
        // Find the index of the refund request for the specific course
        const refundRequestIndex = refundRequestDoc.refundRequests.findIndex((request) => { var _a; return ((_a = request.course) === null || _a === void 0 ? void 0 : _a.toString()) === courseId; });
        if (refundRequestIndex === -1) {
            return res
                .status(404)
                .json({ message: "Refund request for the course not found" });
        }
        // Update the status of the refund request
        refundRequestDoc.refundRequests[refundRequestIndex].status = status;
        yield refundRequestDoc.save();
        // If the status is 'approved', remove the course from the user's purchasedCourses array
        if (status === "approved") {
            const user = yield db_1.User.findOne({ email: userEmail });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            user.purchasedCourses.pull({ course: courseId });
            yield user.save();
        }
        res.json({
            message: "Refund request status updated successfully",
            refundRequest: refundRequestDoc.refundRequests[refundRequestIndex],
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}));
router.get("/students", auth_2.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const students = yield db_1.User.find({ role: "user" })
            .populate({
            path: "purchasedCourses.course",
            select: "title description price imageLink status category discount published syllabus publishDate purchaseDate",
        })
            .exec();
        if (students.length > 0) {
            res.status(200).json({ data: students });
        }
        else {
            res.json({ data: "no students found." });
        }
    }
    catch (error) {
        res.status(500).json({ message: "Error" });
    }
}));
exports.default = router;
