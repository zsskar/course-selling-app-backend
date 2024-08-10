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
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Middleware to handle JSON body parsing
router.use(express_1.default.json());
router.post("/log-visit", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { deviceType } = req.body;
    if (!deviceType) {
        return res.status(400).json({ message: "deviceType is required" });
    }
    // Use IST time zone for date
    const today = (0, moment_timezone_1.default)().tz("Asia/Kolkata").startOf("day").toDate();
    try {
        const log = yield db_1.DeviceLog.findOne({ deviceType, date: today });
        if (log) {
            log.count += 1;
            yield log.save();
        }
        else {
            const newLog = new db_1.DeviceLog({ deviceType, date: today });
            yield newLog.save();
        }
        res.status(200).json({ message: "Visit logged" });
    }
    catch (error) {
        console.error("Failed to log visit:", error);
        res.status(500).json({ message: "Failed to log visit" });
    }
}));
router.get("/getDeviceLogs", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const logs = yield db_1.DeviceLog.find().sort({ date: -1 });
        res.status(200).json(logs);
    }
    catch (error) {
        console.error("Failed to fetch logs:", error);
        res.status(500).send("Failed to fetch logs");
    }
}));
router.get("/range", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).send("startDate and endDate are required");
    }
    try {
        const start = (0, moment_timezone_1.default)(startDate)
            .tz("Asia/Kolkata")
            .startOf("day")
            .toDate();
        const end = (0, moment_timezone_1.default)(endDate)
            .tz("Asia/Kolkata")
            .endOf("day")
            .toDate();
        const logs = yield db_1.DeviceLog.aggregate([
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
    }
    catch (error) {
        console.error("Failed to fetch logs in range:", error);
        res.status(500).send("Failed to fetch logs in range");
    }
}));
router.get("/last10Days", auth_1.authenticateJwt, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const endDate = (0, moment_timezone_1.default)().tz("Asia/Kolkata").endOf("day").toDate();
        const startDate = (0, moment_timezone_1.default)()
            .tz("Asia/Kolkata")
            .subtract(10, "days")
            .startOf("day")
            .toDate();
        const logs = yield db_1.DeviceLog.aggregate([
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
    }
    catch (error) {
        console.error("Failed to fetch logs for last 10 days:", error);
        res.status(500).send("Failed to fetch logs for last 10 days");
    }
}));
exports.default = router;
