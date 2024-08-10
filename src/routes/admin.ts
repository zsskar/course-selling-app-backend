import express from "express";
import { Course, Admin, User, RefundRequests } from "../db";
import jwt from "jsonwebtoken";
import { SECRET } from "../middleware/auth";
import { authenticateJwt } from "../middleware/auth";

const router = express.Router();

router.get("/me", authenticateJwt, async (req, res) => {
  const user = req.headers.email;
  if (!user) {
    return res.status(400).json({ msg: "User header is missing" });
  } else {
    const admin = await Admin.findOne({ email: user });
    if (!admin) {
      res.status(403).json({ msg: "Admin doesnt exist" });
      return;
    }
    res.json({
      email: admin.email,
    });
  }
});

router.post("/signup", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  const admin = await Admin.findOne({ email });
  if (admin) {
    res.status(403).json({ message: "Admin already exists" });
  } else {
    const adminObj = { firstName, lastName, email, password, role: "admin" };
    const newAdmin = new Admin(adminObj);
    newAdmin.save();

    const token = jwt.sign({ email, role: "admin" }, SECRET, {
      expiresIn: "1h",
    });
    res.json({ message: "Admin created successfully", token });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email, password });
    if (admin) {
      const token = jwt.sign({ email, role: "admin" }, SECRET, {
        expiresIn: "1h",
      });

      res.json({
        user: admin,
        message: "Logged in successfully  ",
        token,
        tokenTime: 3600,
      });
    } else {
      res.status(403).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.post("/courses", authenticateJwt, async (req, res) => {
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

    const course = new Course(req.body);
    await course.save();

    res.json({ message: "Course created successfully", courseId: course._id });
  } catch (error) {
    console.error("Error creating course:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/courses/:courseId", authenticateJwt, async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.courseId, req.body, {
    new: true,
  });
  if (course) {
    res.json({ message: "Course updated successfully" });
  } else {
    res.status(404).json({ message: "Course not found" });
  }
});

router.get("/courses", authenticateJwt, async (req, res) => {
  const courses = await Course.find({}).sort({ publishDate: -1 }).exec();
  res.json({ courses });
});

router.get("/course/:courseId", authenticateJwt, async (req, res) => {
  const courseId = req.params.courseId;
  const course = await Course.findById(courseId);
  if (course) {
    res.json({ course });
  } else {
    res.status(404).json({ message: "Course not found" });
  }
});

router.get("/dashboard/getAnalytics", authenticateJwt, async (req, res) => {
  try {
    // Total courses
    const totalCourses = await Course.countDocuments({});

    // Published courses
    const publishedCourses = await Course.countDocuments({ published: true });

    // Purchased courses
    const purchasedCourses = await User.aggregate([
      { $unwind: "$purchasedCourses" },
      { $count: "totalPurchasedCourses" },
    ]);
    const totalPurchasedCourses =
      purchasedCourses.length > 0
        ? purchasedCourses[0].totalPurchasedCourses
        : 0;

    // Total students
    const totalStudents = await User.countDocuments({
      "purchasedCourses.0": { $exists: true },
    });

    // Total Purchased Courses Amount
    const totalPurchasedCoursesAmountData = await User.aggregate([
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

    const totalPurchasedCoursesAmount =
      totalPurchasedCoursesAmountData.length > 0
        ? totalPurchasedCoursesAmountData[0].totalAmount
        : 0;

    // Total refund requests
    const totalRefundRequestsData = await RefundRequests.aggregate([
      { $unwind: "$refundRequests" },
      { $count: "totalRefundRequests" },
    ]);
    const totalRefundRequests =
      totalRefundRequestsData.length > 0
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/getRefundRequests", authenticateJwt, async (req, res) => {
  try {
    // Fetch all refund requests
    const refundRequests = await RefundRequests.find({}).lean();

    // Create a response array
    const responseData = [];

    for (const refundRequest of refundRequests) {
      // Find the user by email
      const user = await User.findOne({ email: refundRequest.email }).lean();

      if (user) {
        // Fetch course details for purchasedCourses
        const purchasedCourses = await Promise.all(
          user.purchasedCourses.map(async (purchasedCourse) => {
            const course = await Course.findById(purchasedCourse.course).lean();
            return {
              ...purchasedCourse,
              courseDetails: course, // Include full course details
            };
          })
        );

        // Map each refund request with course details and purchasedDate
        const enrichedRefundRequests = await Promise.all(
          refundRequest.refundRequests.map(async (req) => {
            const course = await Course.findById(req.course).lean();
            const purchasedCourse = purchasedCourses.find(
              (pc) =>
                pc.course !== null &&
                pc.course !== undefined &&
                pc.course.toString() ===
                  (req.course !== null &&
                    req.course !== undefined &&
                    req.course.toString())
            );

            return {
              _id: req._id,
              course: {
                ...course, // Include full course details
                purchasedDate: purchasedCourse
                  ? purchasedCourse.purchasedDate
                  : null,
              },
              status: req.status,
              requestDate: req.requestDate,
            };
          })
        );

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
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post(
  "/approveOrRejectRefundRequest",
  authenticateJwt,
  async (req, res) => {
    const { userEmail, courseId, status } = req.body;

    try {
      if (!userEmail || !courseId || !status) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Find the refund request document by email
      const refundRequestDoc = await RefundRequests.findOne({
        email: userEmail,
      });
      if (!refundRequestDoc) {
        return res
          .status(404)
          .json({ message: "Refund request document not found" });
      }

      // Find the index of the refund request for the specific course
      const refundRequestIndex = refundRequestDoc.refundRequests.findIndex(
        (request) => request.course?.toString() === courseId
      );

      if (refundRequestIndex === -1) {
        return res
          .status(404)
          .json({ message: "Refund request for the course not found" });
      }

      // Update the status of the refund request
      refundRequestDoc.refundRequests[refundRequestIndex].status = status;
      await refundRequestDoc.save();

      // If the status is 'approved', remove the course from the user's purchasedCourses array
      if (status === "approved") {
        const user = await User.findOne({ email: userEmail });
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        user.purchasedCourses.pull({ course: courseId });
        await user.save();
      }

      res.json({
        message: "Refund request status updated successfully",
        refundRequest: refundRequestDoc.refundRequests[refundRequestIndex],
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

router.get("/students", authenticateJwt, async (req, res) => {
  try {
    const students = await User.find({ role: "user" })
      .populate({
        path: "purchasedCourses.course",
        select:
          "title description price imageLink status category discount published syllabus publishDate purchaseDate",
      })
      .exec();
    if (students.length > 0) {
      res.status(200).json({ data: students });
    } else {
      res.status(404).json({ data: "no students found." });
    }
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
});

export default router;
