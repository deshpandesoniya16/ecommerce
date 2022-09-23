const {Parser} = require('json2csv');


const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const ErrorHander = require("../utils/errorhander");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

// Create new Order
exports.newOrder = catchAsyncErrors(async (req, res, next) => {
  const {
    shippingInfo,
    orderItems,
    paymentInfo,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  } = req.body;

  const order = await Order.create({
    shippingInfo,
    orderItems,
    paymentInfo,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    paidAt: Date.now(),
    user: req.user._id,
  });

  res.status(201).json({
    success: true,
    order,
  });
});

// get Single Order
exports.getSingleOrder = catchAsyncErrors(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate(
    "user",
    "name email"
  );

  if (!order) {
    return next(new ErrorHander("Order not found with this Id", 404));
  }

  res.status(200).json({
    success: true,
    order,
  });
});

// get logged in user  Orders
exports.myOrders = catchAsyncErrors(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id });

  res.status(200).json({
    success: true,
    orders,
  });
});

// get all Orders -- Admin
exports.getAllOrders = catchAsyncErrors(async (req, res, next) => {
  const orders = await Order.find();

  let totalAmount = 0;

  orders.forEach((order) => {
    totalAmount += order.totalPrice;
  });

  res.status(200).json({
    success: true,
    totalAmount,
    orders,
  });
});

// update Order Status -- Admin
exports.updateOrder = catchAsyncErrors(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ErrorHander("Order not found with this Id", 404));
  }

  if (order.orderStatus === "Delivered") {
    return next(new ErrorHander("You have already delivered this order", 400));
  }

  if (req.body.status === "Shipped") {
    order.orderItems.forEach(async (o) => {
      await updateStock(o.product, o.quantity);
    });
  }
  order.orderStatus = req.body.status;

  if (req.body.status === "Delivered") {
    order.deliveredAt = Date.now();
  }

  await order.save({ validateBeforeSave: false });
  res.status(200).json({
    success: true,
  });
});

async function updateStock(id, quantity) {
  const product = await Product.findById(id);

  product.Stock -= quantity;

  await product.save({ validateBeforeSave: false });
}

// delete Order -- Admin
exports.deleteOrder = catchAsyncErrors(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ErrorHander("Order not found with this Id", 404));
  }

  await order.remove();

  res.status(200).json({
    success: true,
  });
});

exports.monthlySale =  catchAsyncErrors(async (req, res, next) => {
  // get monthly sales for last 12 months
  const GET_REPORT_FOR_NO_OF_MONTHS = 12;

  const orders = {};
  const monthlySales = [];

  const products = await Product.find({ user: req.user._id }, {_id: 1});
  const productIds = products.map((p) => String(p._id));
  let currentDate = new Date();

  for (let i = 0; i < GET_REPORT_FOR_NO_OF_MONTHS; i++) {

    let lastDay;
    const firstDay = new Date(currentDate.getFullYear() 
    + "/" + (currentDate.getMonth() + 1) + "/" + 1).toISOString();
    if (i === 0){
      lastDay = currentDate.toISOString();
    } else {
      lastDay = new Date(currentDate.getFullYear(), 
      currentDate.getMonth() + 1, 0).toISOString();
    }
    const monthAndYear = new Date(firstDay).toLocaleString('en-us',{month:'short', year:'numeric'});
    orders[monthAndYear] 
    = await Order.find( { createdAt: { $gte: firstDay, $lte: lastDay
    }, orderStatus: {$in: ['Processing', 'Shipped']}}, {orderItems: 1}); 
    currentDate.setMonth(currentDate.getMonth() - 1);
  }
  for (const month in orders){
    let totalSales = 0;
    (orders[month] || []).forEach((o) => {
      (o.orderItems || []).forEach((item) => {
 
        console.log(productIds.includes(String(item.product._id)), 'productIds.includes(item.product)');
        if(productIds.includes(String(item.product._id))){
          totalSales += item.price * item.quantity;
        } 
      });
    });
    monthlySales.push({ 'month':month, 'totalSales': String(totalSales)});
  }

  // const json2csv = new Parser({ fields });
  // const csv = json2csv.parse(data);
  // res.header('Content-Type', 'text/csv');
  // res.attachment(fileName);
  // return res.send(csv);

  const parser = new Parser({fields: ['month', 'totalSales']});
  const csvString = parser.parse(monthlySales);
  res.setHeader('Content-disposition', 'attachment; filename=shifts-report.csv');
  res.set('Content-Type', 'text/csv');
  return res.status(200).send(csvString);



  console.log(monthlySales, 'monthlySales');
  res.status(200).json({
    success: true,
    monthlySales
  });
});