const orderService = require("../services/order.service");

exports.processOrder = async (req, res) => {

  try {

    const orderId = req.body.orderId; // ✅ MATCH FRONTEND

    console.log("\n==============================");
    console.log("[CONTROLLER] processOrder called");
    console.log("Order ID:", orderId);
    console.log("==============================\n");

    console.log("BODY RECEIVED:", req.body);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required"
      });
    }

    const result = await orderService.processOrder(orderId);

    res.json({
      success: true,
      data: result
    });

  } catch (err) {

    console.error("[CONTROLLER ERROR]", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};