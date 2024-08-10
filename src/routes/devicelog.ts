import express from "express";
import moment from "moment-timezone";
import { DeviceLog } from "../db";
import { authenticateJwt } from "../middleware/auth";
const router = express.Router();

// Middleware to handle JSON body parsing
router.use(express.json());

router.post("/log-visit", async (req, res) => {
  const { deviceType } = req.body;
  if (!deviceType) {
    return res.status(400).json({ message: "deviceType is required" });
  }

  // Use IST time zone for date
  const today = moment().tz("Asia/Kolkata").startOf("day").toDate();

  try {
    const log = await DeviceLog.findOne({ deviceType, date: today });
    if (log) {
      log.count += 1;
      await log.save();
    } else {
      const newLog = new DeviceLog({ deviceType, date: today });
      await newLog.save();
    }
    res.status(200).json({ message: "Visit logged" });
  } catch (error) {
    console.error("Failed to log visit:", error);
    res.status(500).json({ message: "Failed to log visit" });
  }
});

router.get("/getDeviceLogs", async (req, res) => {
  try {
    const logs = await DeviceLog.find().sort({ date: -1 });
    res.status(200).json(logs);
  } catch (error) {
    console.error("Failed to fetch logs:", error);
    res.status(500).send("Failed to fetch logs");
  }
});

router.get("/range", async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("startDate and endDate are required");
  }

  try {
    const start = moment(startDate as string)
      .tz("Asia/Kolkata")
      .startOf("day")
      .toDate();
    const end = moment(endDate as string)
      .tz("Asia/Kolkata")
      .endOf("day")
      .toDate();

    const logs = await DeviceLog.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$date",
                timezone: "Asia/Kolkata",
              },
            },
            deviceType: "$deviceType",
          },
          totalCount: { $sum: "$count" },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          counts: {
            $push: {
              k: "$_id.deviceType",
              v: "$totalCount",
            },
          },
        },
      },
      {
        $addFields: {
          date: "$_id",
          counts: {
            $arrayToObject: "$counts",
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: 1,
          counts: 1,
        },
      },
      {
        $sort: { date: 1 },
      },
    ]);

    const response = logs.reduce((acc, log) => {
      acc[log.date] = log.counts;
      return acc;
    }, {});

    res.status(200).json(response);
  } catch (error) {
    console.error("Failed to fetch logs in range:", error);
    res.status(500).send("Failed to fetch logs in range");
  }
});

router.get("/last10Days", authenticateJwt, async (req, res) => {
  try {
    const endDate = moment().tz("Asia/Kolkata").endOf("day").toDate();
    const startDate = moment()
      .tz("Asia/Kolkata")
      .subtract(10, "days")
      .startOf("day")
      .toDate();

    const logs = await DeviceLog.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$date",
                timezone: "Asia/Kolkata",
              },
            },
            deviceType: "$deviceType",
          },
          totalCount: { $sum: "$count" },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          counts: {
            $push: {
              k: "$_id.deviceType",
              v: "$totalCount",
            },
          },
        },
      },
      {
        $addFields: {
          date: "$_id",
          counts: {
            $arrayToObject: {
              $map: {
                input: "$counts",
                as: "count",
                in: {
                  k: "$$count.k",
                  v: "$$count.v",
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: 1,
          counts: 1,
        },
      },
      {
        $sort: { date: 1 },
      },
    ]);

    res.status(200).json({ visits: logs });
  } catch (error) {
    console.error("Failed to fetch logs for last 10 days:", error);
    res.status(500).send("Failed to fetch logs for last 10 days");
  }
});

export default router;
