import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./db.js";
import { appRouter } from "./trpc/router.js";
import { Worker } from "./models/Worker.js";
import { signSessionToken, hashSecret } from "./lib/auth.js";

interface TestResult {
  router: string;
  procedure: string;
  status: "PASS" | "FAIL";
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function recordPass(router: string, procedure: string, details?: string) {
  results.push({ router, procedure, status: "PASS", details });
  console.log(`  [PASS] ${router}.${procedure}${details ? ` -> ${details}` : ""}`);
}

function recordFail(router: string, procedure: string, error: any) {
  const errMsg = error instanceof Error ? error.message : String(error);
  results.push({ router, procedure, status: "FAIL", error: errMsg });
  console.error(`  [FAIL] ${router}.${procedure} -> ${errMsg}`);
}

async function runAllTests() {
  console.log("=== Testing All Fabric Care API Endpoints ===");
  await connectDB();

  // 1. Ensure a test admin exists and get token & context
  let adminWorker = await Worker.findOne({ role: "admin", active: true });
  if (!adminWorker) {
    const pinHash = await hashSecret("1234");
    const passwordHash = await hashSecret("AdminPassword123!");
    adminWorker = await Worker.create({
      name: "Test Admin",
      email: "test.admin@fabriccare.local",
      passwordHash,
      pinHash,
      role: "admin",
      active: true,
    });
  }

  const adminToken = signSessionToken(adminWorker._id.toString());
  const adminCtx = {
    userId: adminWorker._id.toString(),
    activeRole: "admin" as const,
  };

  const caller = appRouter.createCaller(adminCtx);

  console.log("\n--- 1. Testing Auth Router ---");
  try {
    const me = await caller.auth.me();
    if (me.id && me.name) {
      recordPass("auth", "me", `Logged in as ${me.name} (${me.role})`);
    } else {
      recordFail("auth", "me", "Invalid response shape");
    }
  } catch (e) {
    recordFail("auth", "me", e);
  }

  try {
    const refreshed = await caller.auth.refreshToken();
    if (refreshed.token && refreshed.user) {
      recordPass("auth", "refreshToken", "Refreshed session token successfully");
    } else {
      recordFail("auth", "refreshToken", "Invalid response");
    }
  } catch (e) {
    recordFail("auth", "refreshToken", e);
  }

  try {
    const logoutRes = await caller.auth.logout();
    recordPass("auth", "logout", JSON.stringify(logoutRes));
  } catch (e) {
    recordFail("auth", "logout", e);
  }

  console.log("\n--- 2. Testing Shops Router ---");
  try {
    const shops = await caller.shops.list();
    recordPass("shops", "list", `Found ${shops.length} shop(s): ${shops[0]?.name}`);
  } catch (e) {
    recordFail("shops", "list", e);
  }

  try {
    const audit = await caller.shops.audit();
    recordPass("shops", "audit", `Orders count: ${audit.counts.orders}, Customers: ${audit.counts.customers}`);
  } catch (e) {
    recordFail("shops", "audit", e);
  }

  try {
    const updated = await caller.shops.updateSettings({
      name: "Fabric Care Premium",
      address: "17/B3, 1st street, Pandian Nagar, Dindigul",
      customerNotifications: true,
      pricingTier: "Standard",
      defaultStaffIroningRate: 10,
      defaultStaffWashRate: 15,
      defaultRateUnit: "per_piece",
    });
    recordPass("shops", "updateSettings", `Updated name: ${updated.name}`);
  } catch (e) {
    recordFail("shops", "updateSettings", e);
  }

  try {
    const backup = await caller.shops.recordBackup();
    recordPass("shops", "recordBackup", `Backup timestamp: ${backup.lastBackupAt}`);
  } catch (e) {
    recordFail("shops", "recordBackup", e);
  }

  console.log("\n--- 3. Testing Products Router ---");
  let createdProductId = "";
  try {
    const prods = await caller.products.list();
    recordPass("products", "list", `Loaded ${prods.length} products`);
  } catch (e) {
    recordFail("products", "list", e);
  }

  try {
    const activeProds = await caller.products.activeList();
    recordPass("products", "activeList", `Loaded ${activeProds.length} active products`);
  } catch (e) {
    recordFail("products", "activeList", e);
  }

  const testProdName = `Test Silk Kurta ${Date.now()}`;
  try {
    const createdProd = await caller.products.create({
      name: testProdName,
      category: "Men's Wear",
      serviceType: "Dry Clean",
      price: 150,
      staffWashRate: 30,
      staffIroningRate: 20,
      rateUnit: "per_piece",
      status: "Active",
    });
    createdProductId = createdProd.id;
    recordPass("products", "create", `Created product ID: ${createdProd.id}`);
  } catch (e) {
    recordFail("products", "create", e);
  }

  if (createdProductId) {
    try {
      const updatedProd = await caller.products.update({
        id: createdProductId,
        price: 160,
      });
      recordPass("products", "update", `Updated price: ${updatedProd.price}`);
    } catch (e) {
      recordFail("products", "update", e);
    }

    try {
      const toggled = await caller.products.toggleStatus({ id: createdProductId });
      recordPass("products", "toggleStatus", `Status toggled to: ${toggled.status}`);
    } catch (e) {
      recordFail("products", "toggleStatus", e);
    }

    try {
      const deleted = await caller.products.delete({ id: createdProductId });
      recordPass("products", "delete", `Deleted product (archived: ${deleted.archived})`);
    } catch (e) {
      recordFail("products", "delete", e);
    }
  }

  console.log("\n--- 4. Testing Customers Router ---");
  let testCustomerId = "";
  const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testCustCode = `CUST-${Date.now().toString().slice(-4)}`;

  try {
    const custs = await caller.customers.list();
    recordPass("customers", "list", `Loaded ${custs.length} customers`);
  } catch (e) {
    recordFail("customers", "list", e);
  }

  try {
    const searchRes = await caller.customers.search({ query: "a", limit: 5 });
    recordPass("customers", "search", `Search returned ${searchRes.length} items`);
  } catch (e) {
    recordFail("customers", "search", e);
  }

  try {
    const checkDup = await caller.customers.checkDuplicate({ phone: testPhone });
    recordPass("customers", "checkDuplicate", `Duplicate exists: ${checkDup.exists}`);
  } catch (e) {
    recordFail("customers", "checkDuplicate", e);
  }

  try {
    const newCust = await caller.customers.create({
      customerId: testCustCode,
      name: "Test Customer A",
      phone: testPhone,
      customerType: "Normal",
      address: "123 Main Road",
      notes: "Test customer profile",
    });
    testCustomerId = newCust.id;
    recordPass("customers", "create", `Created customer: ${newCust.name} (ID: ${newCust.customerId})`);
  } catch (e) {
    recordFail("customers", "create", e);
  }

  if (testCustomerId) {
    try {
      const updatedCust = await caller.customers.update({
        id: testCustomerId,
        notes: "Updated preferences",
      });
      recordPass("customers", "update", `Updated customer notes: ${updatedCust.notes}`);
    } catch (e) {
      recordFail("customers", "update", e);
    }
  }

  console.log("\n--- 5. Testing Orders Router ---");
  let testOrderId = "";
  try {
    const orders = await caller.orders.list();
    recordPass("orders", "list", `Loaded ${orders.length} orders`);
  } catch (e) {
    recordFail("orders", "list", e);
  }

  try {
    const order = await caller.orders.create({
      customerId: testCustCode,
      customerName: "Test Customer A",
      phone: testPhone,
      customerType: "Normal",
      serviceType: "Wash & Iron",
      deliveryType: "Shop Collection",
      totalAmount: 200,
      amountPaid: 50,
      discount: 0,
      items: [
        {
          name: "Shirt",
          quantity: 2,
          price: 50,
          staffIroningRate: 10,
          clothTags: ["TAG-01", "TAG-02"],
        },
        {
          name: "Pant",
          quantity: 1,
          price: 60,
          staffIroningRate: 10,
          clothTags: ["TAG-03"],
        },
      ],
    });
    testOrderId = order.id;
    recordPass("orders", "create", `Created order #${order.id} for ${order.customer} (₹${order.totalAmount})`);
  } catch (e) {
    recordFail("orders", "create", e);
  }

  if (testOrderId) {
    try {
      const movedOrder = await caller.orders.updateStatus({
        id: testOrderId,
        status: "Processing",
      });
      recordPass("orders", "updateStatus", `Order #${movedOrder.id} status is now ${movedOrder.status}`);
    } catch (e) {
      recordFail("orders", "updateStatus", e);
    }

    try {
      const bulkRes = await caller.orders.bulkUpdateStatus({
        ids: [testOrderId],
        status: "Received",
      });
      recordPass("orders", "bulkUpdateStatus", `Bulk updated ${bulkRes.count} order(s)`);
    } catch (e) {
      recordFail("orders", "bulkUpdateStatus", e);
    }

    try {
      const settled = await caller.orders.settlePayment({
        id: testOrderId,
        amount: 150,
        markCollected: true,
      });
      recordPass("orders", "settlePayment", `Settled payment. Status: ${settled.status}, Paid: ${settled.amountPaid}`);
    } catch (e) {
      recordFail("orders", "settlePayment", e);
    }
  }

  console.log("\n--- 6. Testing Ironing Workflow Router ---");
  try {
    const todayStats = await caller.ironing.todayStats();
    recordPass("ironing", "todayStats", `Today pieces: ${todayStats.todayPieces}, Labour cost: ₹${todayStats.todayLabourCost}`);
  } catch (e) {
    recordFail("ironing", "todayStats", e);
  }

  let ironingOrderId = "";
  try {
    const newOrd = await caller.orders.create({
      customerId: testCustCode,
      customerName: "Test Customer A",
      phone: testPhone,
      customerType: "Normal",
      serviceType: "Wash & Iron",
      totalAmount: 110,
      amountPaid: 0,
      items: [
        { name: "Shirt", quantity: 1, price: 50, staffIroningRate: 10 },
        { name: "Pant", quantity: 1, price: 60, staffIroningRate: 10 },
      ],
    });
    ironingOrderId = newOrd.id;

    // Start Ironing
    const startRes = await caller.ironing.startIroning({
      orderId: ironingOrderId,
      staffId: adminWorker._id.toString(),
    });
    recordPass("ironing", "startIroning", `${startRes.message}`);

    // Get Active Task
    const activeTask = await caller.ironing.getActiveTask({ orderId: ironingOrderId });
    if (activeTask && activeTask.status === "In Progress") {
      recordPass("ironing", "getActiveTask", `Task for ${activeTask.staffName}, Total pieces: ${activeTask.totalPieces}`);
    } else {
      recordFail("ironing", "getActiveTask", "Task not found or wrong status");
    }

    // Complete Ironing
    const completeRes = await caller.ironing.completeIroning({
      orderId: ironingOrderId,
      staffId: adminWorker._id.toString(),
    });
    recordPass("ironing", "completeIroning", `${completeRes.message}`);

    // Ironing Performance Reports
    const rep = await caller.ironing.reports({ period: "today" });
    recordPass("ironing", "reports", `Total pieces: ${rep.totalPieces}, Total earnings: ₹${rep.totalEarnings}`);
  } catch (e) {
    recordFail("ironing", "full_workflow", e);
  }

  console.log("\n--- 7. Testing Expenses Router ---");
  let testExpenseId = "";
  try {
    const expenses = await caller.expenses.list();
    recordPass("expenses", "list", `Loaded ${expenses.length} expenses`);
  } catch (e) {
    recordFail("expenses", "list", e);
  }

  try {
    const createdExp = await caller.expenses.create({
      title: "Detergent Box 5kg",
      category: "Supplies",
      amount: 450,
      paymentMethod: "UPI",
      expenseDate: new Date().toISOString(),
      notes: "Ariel Matic liquid detergent",
    });
    testExpenseId = createdExp.id;
    recordPass("expenses", "create", `Created expense ID: ${createdExp.id}`);
  } catch (e) {
    recordFail("expenses", "create", e);
  }

  if (testExpenseId) {
    try {
      const updatedExp = await caller.expenses.update({
        id: testExpenseId,
        title: "Detergent Box 5kg (Updated)",
        category: "Supplies",
        amount: 470,
        paymentMethod: "UPI",
        expenseDate: new Date().toISOString(),
        notes: "Updated price",
      });
      recordPass("expenses", "update", `Updated amount: ₹${updatedExp.amount}`);
    } catch (e) {
      recordFail("expenses", "update", e);
    }

    try {
      await caller.expenses.delete({ id: testExpenseId });
      recordPass("expenses", "delete", "Moved expense to Recycle Bin");
    } catch (e) {
      recordFail("expenses", "delete", e);
    }
  }

  console.log("\n--- 8. Testing Dashboard & Reports Router ---");
  try {
    const dashStats = await caller.dashboard.stats();
    recordPass("dashboard", "stats", `Revenue: ₹${dashStats.todaysRevenue}, In-Process: ${dashStats.inProcessCount}`);
  } catch (e) {
    recordFail("dashboard", "stats", e);
  }

  try {
    const statements = await caller.reports.businessStatements({ period: "month" });
    recordPass("reports", "businessStatements", `Total Revenue: ₹${statements.totalRevenue}, Net Profit: ₹${statements.netProfit}`);
  } catch (e) {
    recordFail("reports", "businessStatements", e);
  }

  console.log("\n--- 9. Testing Workers & Roles Router ---");
  let testWorkerId = "";
  try {
    const staffList = await caller.workers.staffList();
    recordPass("workers", "staffList", `Found ${staffList.length} staff members`);
  } catch (e) {
    recordFail("workers", "staffList", e);
  }

  try {
    const activeStaff = await caller.workers.activeStaffList();
    recordPass("workers", "activeStaffList", `Found ${activeStaff.length} active staff members`);
  } catch (e) {
    recordFail("workers", "activeStaffList", e);
  }

  try {
    const allWorkers = await caller.workers.list();
    recordPass("workers", "list", `Found ${allWorkers.length} workers in admin list`);
  } catch (e) {
    recordFail("workers", "list", e);
  }

  try {
    const createdW = await caller.workers.create({
      name: "Test Staff Member",
      role: "staff",
    });
    testWorkerId = createdW.id;
    recordPass("workers", "create", `Created worker ID: ${createdW.id} (${createdW.name})`);
  } catch (e) {
    recordFail("workers", "create", e);
  }

  if (testWorkerId) {
    try {
      const toggledW = await caller.workers.toggleActive({ workerId: testWorkerId });
      recordPass("workers", "toggleActive", `${toggledW.message}`);
    } catch (e) {
      recordFail("workers", "toggleActive", e);
    }

    try {
      await caller.workers.setPin({ workerId: testWorkerId, pin: "5678" });
      recordPass("workers", "setPin", "PIN set to 5678");
    } catch (e) {
      recordFail("workers", "setPin", e);
    }

    try {
      const pinVerify = await caller.workers.verifyPin({ workerId: testWorkerId, pin: "5678" });
      if (pinVerify.success) {
        recordPass("workers", "verifyPin", `PIN verified successfully (Role token issued)`);
      } else {
        recordFail("workers", "verifyPin", "PIN verification failed");
      }
    } catch (e) {
      recordFail("workers", "verifyPin", e);
    }

    try {
      await caller.workers.delete({ workerId: testWorkerId });
      recordPass("workers", "delete", "Worker deleted");
    } catch (e) {
      recordFail("workers", "delete", e);
    }
  }

  console.log("\n--- 10. Testing Devices Router ---");
  try {
    const devList = await caller.devices.list();
    recordPass("devices", "list", `Found ${devList.length} registered devices`);
  } catch (e) {
    recordFail("devices", "list", e);
  }

  try {
    const regDev = await caller.devices.register({
      deviceLabel: "Testing Tablet Chrome",
      userAgent: "Mozilla/5.0 Test Suite",
    });
    recordPass("devices", "register", `Device registered ID: ${regDev.id}`);
  } catch (e) {
    recordFail("devices", "register", e);
  }

  console.log("\n--- 11. Testing Recycle Bin Router ---");
  // Delete test order to have it in Recycle Bin
  if (testOrderId) {
    try {
      await caller.orders.delete({ id: testOrderId, reason: "Automated Test Cleanup" });
      recordPass("orders", "delete", `Moved order #${testOrderId} to Recycle Bin`);
    } catch (e) {
      recordFail("orders", "delete", e);
    }
  }

  if (testCustomerId) {
    try {
      await caller.customers.delete({ id: testCustomerId });
      recordPass("customers", "delete", `Moved customer ${testCustomerId} to Recycle Bin`);
    } catch (e) {
      recordFail("customers", "delete", e);
    }
  }

  try {
    const binCounts = await caller.recycleBin.counts();
    recordPass("recycleBin", "counts", `Total in bin: ${binCounts.total} (Orders: ${binCounts.orders}, Customers: ${binCounts.customers}, Expenses: ${binCounts.expenses})`);
  } catch (e) {
    recordFail("recycleBin", "counts", e);
  }

  try {
    const binList = await caller.recycleBin.list();
    recordPass("recycleBin", "list", `Loaded ${binList.length} items in Recycle Bin`);
  } catch (e) {
    recordFail("recycleBin", "list", e);
  }

  if (testOrderId) {
    try {
      const rest = await caller.recycleBin.restore({ type: "order", id: testOrderId });
      recordPass("recycleBin", "restore", `${rest.message}`);
    } catch (e) {
      recordFail("recycleBin", "restore", e);
    }

    try {
      const permDel = await caller.recycleBin.deleteForever({ type: "order", id: testOrderId });
      recordPass("recycleBin", "deleteForever", `${permDel.message}`);
    } catch (e) {
      recordFail("recycleBin", "deleteForever", e);
    }
  }

  if (ironingOrderId) {
    try {
      await caller.recycleBin.deleteForever({ type: "order", id: ironingOrderId });
      recordPass("recycleBin", "deleteForever (ironing order)", "Cleaned up test ironing order");
    } catch (e) {}
  }

  if (testCustomerId) {
    try {
      const permDelCust = await caller.recycleBin.deleteForever({ type: "customer", id: testCustomerId });
      recordPass("recycleBin", "deleteForever (customer)", `${permDelCust.message}`);
    } catch (e) {
      recordFail("recycleBin", "deleteForever (customer)", e);
    }
  }

  console.log("\n================ SUMMARY ================");
  const total = results.length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`Total Endpoints Tested: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error("\nFailed Endpoints:");
    for (const f of results.filter((r) => r.status === "FAIL")) {
      console.error(` - ${f.router}.${f.procedure}: ${f.error}`);
    }
  }

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
