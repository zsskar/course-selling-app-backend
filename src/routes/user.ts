import express from "express";
import { authenticateJwt, SECRET } from "../middleware/auth";
import { User, Course, ICourse, RefundRequests, Admin } from "../db";
import jwt from "jsonwebtoken";

const router = express.Router();

router.post("/signup", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    res.status(403).json({ message: "User already exists" });
  } else {
    const newUser = new User({
      firstName,
      lastName,
      email,
      password,
      role: "user",
    });
    await newUser.save();
    const token = jwt.sign({ email, role: "user" }, SECRET, {
      expiresIn: "1h",
    });
    res.json({ message: "User created successfully", token });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email, password })
      .populate({
        path: "purchasedCourses.course",
        select:
          "title description price imageLink status category discount published syllabus publishDate purchaseDate",
      })
      .exec();

    if (user) {
      const token = jwt.sign({ email, role: user.role || "user" }, SECRET, {
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
    } else {
      res.status(403).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.get("/filterCourses", authenticateJwt, async (req, res) => {
  const email = req.headers.email as string; // Ensure email is properly typed

  try {
    // Find the user by email and populate the purchasedCourses field
    const user = await User.findOne({ email })
      .populate({
        path: "purchasedCourses.course",
        select:
          "title description price imageLink status category discount published syllabus publishDate purchaseDate",
      })
      .exec();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Extract purchased course IDs, checking for null or undefined
    const purchasedCourseIds = user.purchasedCourses
      .map((course) => course.course?._id) // Use optional chaining
      .filter((id) => id !== undefined); // Remove undefined values

    // Find courses that are published and not in the user's purchased list
    const courses = await Course.find({
      published: true,
      _id: { $nin: purchasedCourseIds },
    })
      .sort({ publishDate: -1 })
      .exec();

    res.json({ courses });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.get("/courses", async (req, res) => {
  const courses = await Course.find({ published: true })
    .sort({ publishDate: -1 })
    .exec();
  res.json({ courses });
});

router.post("/courses/:courseId", authenticateJwt, async (req, res) => {
  const courseId = req.params.courseId;
  const email = req.headers.email as string; // Ensure email is properly typed

  try {
    // Find the course by ID
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (!email) {
      return res.status(400).json({ message: "Email header is missing" });
    }

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(403).json({ message: "User not found" });
    }

    // Check if the course is already purchased
    const alreadyPurchased = user.purchasedCourses.some(
      (purchasedCourse) => purchasedCourse.course?.toString() === courseId
    );

    if (alreadyPurchased) {
      return res.status(400).json({ message: "Course already purchased" });
    }

    // Add the course to the user's purchasedCourses array with the purchase date
    user.purchasedCourses.push({
      course: course._id,
      purchasedDate: new Date(), // Set the purchase date to now
    });

    await user.save();
    res.json({ message: "Course purchased successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.get("/purchasedCourses", authenticateJwt, async (req, res) => {
  const email = req.headers.email as string; // Ensure email is properly typed

  try {
    if (!email) {
      return res.status(400).json({ message: "Email header is missing" });
    }

    // Find the user by email and populate the purchasedCourses field
    const user = await User.findOne({ email })
      .populate({
        path: "purchasedCourses.course",
        select:
          "title description price imageLink status category discount published syllabus publishDate purchaseDate",
      })
      .exec();

    if (user) {
      // Ensure course data is available and properly formatted
      const courses = user.purchasedCourses
        .filter((purchasedCourse) => purchasedCourse.course != null) // Filter out null or undefined courses
        .map((purchasedCourse) => ({
          ...(purchasedCourse.course as any)._doc, // Type assertion for course
          purchasedDate: purchasedCourse.purchasedDate, // Include the purchase date
        }));

      res.json({ courses });
    } else {
      res.status(403).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.get("/dashboard/getAnalytics", authenticateJwt, async (req, res) => {
  const userEmail = req.headers.email as string;

  try {
    if (!userEmail) {
      return res.status(400).json({ message: "Email header is missing" });
    }

    // Find the user by email and populate purchasedCourses with course details
    const user = await User.findOne({ email: userEmail })
      .populate<{
        purchasedCourses: { course: ICourse & { price: number } }[];
      }>("purchasedCourses.course")
      .exec();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Ensure purchasedCourses is populated with course documents
    const purchasedCourses = user.purchasedCourses
      .map((purchasedCourse) => purchasedCourse.course)
      .filter((course) => course != null);

    // Calculate the total purchased courses amount
    const totalPurchasedCoursesAmount = purchasedCourses.reduce(
      (acc, course) =>
        acc +
        (course?.discount == 0
          ? course?.price
          : course?.price - (course?.price * course?.discount) / 100),
      0
    );

    // Get the count of purchased courses
    const purchasedCoursesCount = purchasedCourses.length;

    // Count the total refund requests for the user
    const userRefundRequestsData = await RefundRequests.aggregate([
      { $match: { email: userEmail } },
      { $unwind: "$refundRequests" },
      { $count: "totalRefundRequests" },
    ]);

    const totalRefundRequests =
      userRefundRequestsData.length > 0
        ? userRefundRequestsData[0].totalRefundRequests
        : 0;

    // Construct the dashboard object
    const dashboard = {
      purchasedCoursesCount,
      totalPurchasedCoursesAmount,
      totalRefundRequests,
    };

    res.json({ dashboard });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/makeRefundRequest", authenticateJwt, async (req, res) => {
  const { course } = req.body;
  const email = req.headers.email as string;

  if (!course || !email) {
    return res.status(400).json({ message: "Course and email are required" });
  }

  try {
    // Check if the course and user exist
    const user = await User.findOne({ email });
    const courseExists = await Course.findById(course);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!courseExists) {
      return res.status(404).json({ message: "Course not found" });
    }

    // console.log(user);

    // Find the purchased date for the course from the user's purchasedCourses
    const purchasedCourse = user.purchasedCourses.find(
      (pc) =>
        pc.course != null && pc.course.toString() === course._id.toString()
    );
    // console.log("purchasedCourse: ", purchasedCourse);

    if (!purchasedCourse) {
      return res
        .status(404)
        .json({ message: "Course not purchased by the user" });
    }

    // Find or create a refund request document for the user
    let refundRequest = await RefundRequests.findOne({ email });

    if (!refundRequest) {
      refundRequest = new RefundRequests({ email, refundRequests: [] });
    }

    // Check if a refund request for the same course already exists
    const existingRequest = refundRequest.refundRequests.find(
      (request) => request.course && request.course.toString() === course
    );

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
    const savedRequest = await refundRequest.save();

    res.json({
      refund: savedRequest,
      message: "Refund request made successfully",
    });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/getRefundRequests", authenticateJwt, async (req, res) => {
  const email = req.headers.email as string;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const refundRequest = await RefundRequests.findOne({ email }).populate<{
      refundRequests: {
        course: ICourse;
        requestDate: Date;
        purchasedDate: Date;
        status: string;
      }[];
    }>("refundRequests.course");

    if (!refundRequest) {
      return res.json({ message: "No refund requests found for this email" });
    }

    res.json({ refundRequests: refundRequest.refundRequests });
  } catch (error) {
    // console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/checkEmail", authenticateJwt, async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ message: "email is required." });
    }

    const user = await User.findOne({ email: email });
    const admin = await Admin.findOne({ email: email });

    if (user || admin) {
      res.json({ message: "F", user });
    } else {
      res.json({ message: "NF", email });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
  }
});

router.put("/updateAccount/:userId", authenticateJwt, async (req, res) => {
  try {
    const updateFields = {
      firstName: req.body.user.firstName,
      lastName: req.body.user.lastName,
      email: req.body.user.email,
      password: req.body.user.password,
    };

    if (req.body.user.role && req.body.user.role === "user") {
      const user = await User.findByIdAndUpdate(
        req.params.userId,
        { $set: updateFields }, // $set ensures only specified fields are updated
        {
          new: true,
          runValidators: true,
        }
      );
      if (user) {
        res.json({ message: "User updated successfully", user });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } else {
      const user = await Admin.findByIdAndUpdate(
        req.params.userId,
        { $set: updateFields }, // $set ensures only specified fields are updated
        {
          new: true,
          runValidators: true,
        }
      );
      if (user) {
        res.json({ message: "User updated successfully", user });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
  }
});

export default router;
