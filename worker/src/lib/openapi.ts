import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";

import { CategoryRoutes } from "../schemas/categories";
import { ProductRoutes } from "../schemas/products";
import { OrderRoutes } from "../schemas/orders";
import { TableRoutes } from "../schemas/tables";
import { AuthRoutes } from "../schemas/auth";
import { PaymentRoutes } from "../schemas/payments";
import { StaffRoutes } from "../schemas/staff";
import { InventoryRoutes } from "../schemas/inventory";
import { LoyaltyRoutes } from "../schemas/loyalty";
import { PromotionRoutes } from "../schemas/promotions";
import { CronRoutes } from "../schemas/cron";
import { ErrorResponseSchema, SuccessResponseSchema } from "../schemas/common";

// Flatten InventoryRoutes nested structure (ingredients, movements, suppliers, purchaseOrders)
const InventoryRouteValues = [
  ...Object.values(InventoryRoutes.ingredients),
  ...Object.values(InventoryRoutes.movements),
  ...Object.values(InventoryRoutes.suppliers),
  ...Object.values(InventoryRoutes.purchaseOrders),
];
// Flatten LoyaltyRoutes nested structure (tiers, account, rewards, admin)
const LoyaltyRouteValues = [
  ...Object.values(LoyaltyRoutes.tiers),
  ...Object.values(LoyaltyRoutes.account),
  ...Object.values(LoyaltyRoutes.rewards),
  ...Object.values(LoyaltyRoutes.admin),
];
// Flatten PromotionRoutes nested structure (usage, summary)
const PromotionRouteValues = [
  ...Object.values(PromotionRoutes.usage),
  PromotionRoutes.summary,
];
// Flatten CronRoutes nested structure (runs)
const CronRouteValues = [
  ...Object.values(CronRoutes.runs),
];

// Import actual route handlers
import openApiCategoriesRouter from "../routes/openapi-categories";
import openApiProductsRouter from "../routes/openapi-products";
import openApiOrdersRouter from "../routes/openapi-orders";
import openApiTablesRouter from "../routes/openapi-tables";
import openApiAuthRouter from "../routes/openapi-auth";
import openApiPaymentsRouter from "../routes/openapi-payments";
import openApiStaffRouter from "../routes/openapi-staff";
import openApiInventoryRouter from "../routes/openapi-inventory";
import openApiLoyaltyRouter from "../routes/openapi-loyalty";
import openApiPromotionsRouter from "../routes/openapi-promotions";
import openApiCronRouter from "../routes/openapi-cron";

/**
 * OpenAPI specification setup for Aura Space Worker
 * Generates OpenAPI 3.1 spec at /api/json and serves Scalar UI at /api/docs
 */

export const openApiApp = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: result.error.flatten(),
          },
        },
        400
      );
    }
  },
});

// Mount all route handlers
openApiApp.route("/api/categories", openApiCategoriesRouter);
openApiApp.route("/api/products", openApiProductsRouter);
openApiApp.route("/api/orders", openApiOrdersRouter);
openApiApp.route("/api/tables", openApiTablesRouter);
openApiApp.route("/api/auth", openApiAuthRouter);
openApiApp.route("/api/payments", openApiPaymentsRouter);
openApiApp.route("/api/staff", openApiStaffRouter);
openApiApp.route("/api/inventory", openApiInventoryRouter);
openApiApp.route("/api/loyalty", openApiLoyaltyRouter);
openApiApp.route("/api/promotions", openApiPromotionsRouter);
openApiApp.route("/api/cron", openApiCronRouter);

// Register all route schemas for OpenAPI spec generation
// Filter to only include objects with method and path (route definitions), excluding nested objects like TableRoutes.zones
const isRouteDef = (r: unknown): r is { method: string; path: string } =>
  !!r && typeof r === "object" && "method" in r && "path" in r;

const routes = [
  ...Object.values(CategoryRoutes).filter(isRouteDef),
  ...Object.values(ProductRoutes).filter(isRouteDef),
  ...Object.values(OrderRoutes).filter(isRouteDef),
  ...Object.values(TableRoutes).filter(isRouteDef),
  ...Object.values(TableRoutes.zones).filter(isRouteDef),
  ...Object.values(AuthRoutes).filter(isRouteDef),
  ...Object.values(PaymentRoutes).filter(isRouteDef),
  ...Object.values(StaffRoutes).filter(isRouteDef),
  ...InventoryRouteValues.filter(isRouteDef),
  ...LoyaltyRouteValues.filter(isRouteDef),
  ...PromotionRouteValues.filter(isRouteDef),
  // CronRoutes top-level only (exclude nested runs object)
  CronRoutes.list,
  CronRoutes.get,
  CronRoutes.create,
  CronRoutes.update,
  CronRoutes.delete,
  CronRoutes.trigger,
  CronRoutes.summary,
  ...CronRouteValues.filter(isRouteDef),
];

routes.forEach((route, idx) => {
  if (!route || !route.method || !route.path) {
    console.error(`[DEBUG] Malformed route at index ${idx}:`, JSON.stringify(route, null, 2));
    console.error(`[DEBUG] Route keys:`, route ? Object.keys(route) : 'null/undefined');
    throw new Error(`Malformed route at index ${idx}: missing method or path`);
  }
  openApiApp.openapi(route, async (c) => {
    // This will never be reached as routes are handled by mounted routers
    return c.json({ success: true, data: null }, 501);
  });
});

// Health check route
const healthRoute = createRoute({
  method: "get",
  path: "/api/health",
  summary: "Health check endpoint",
  tags: ["System"],
  responses: {
    200: {
      description: "Service healthy",
      content: {
        "application/json": {
          schema: SuccessResponseSchema(
            z.object({
              status: z.literal("ok"),
              timestamp: z.string().datetime(),
              version: z.string(),
              uptime: z.number(),
            })
          ),
        },
      },
    },
  },
});

openApiApp.openapi(healthRoute, (c) => {
  return c.json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      uptime: process.uptime(),
    },
  });
});

// OpenAPI JSON endpoint
openApiApp.doc("/api/json", {
  openapi: "3.1.0",
  info: {
    title: "Aura Space API",
    version: "1.0.0",
    description: "Container Cafe Sa Đéc - Full API specification with bilingual support (vi/en)",
    contact: {
      name: "Aura Space Team",
      email: "dev@aura.cafe",
    },
    license: {
      name: "Proprietary",
    },
  },
  servers: [
    {
      url: "https://api.aura.cafe",
      description: "Production server",
    },
    {
      url: "http://localhost:8787",
      description: "Development server",
    },
  ],
  tags: [
    { name: "Categories", description: "Menu category management" },
    { name: "Products", description: "Product/Menu item management" },
    { name: "Orders", description: "Order processing and management" },
    { name: "Tables", description: "Table and zone management" },
    { name: "Auth", description: "Authentication and authorization" },
    { name: "Payments", description: "Payment processing (PayOS, MoMo, ZaloPay)" },
    { name: "Staff", description: "Staff management and shifts" },
    { name: "Inventory", description: "Inventory and stock management" },
    { name: "Loyalty", description: "Customer loyalty program" },
    { name: "System", description: "System health and utilities" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token from login endpoint",
      },
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description: "API key for server-to-server communication",
      },
      IdempotencyKey: {
        type: "apiKey",
        in: "header",
        name: "Idempotency-Key",
        description: "Idempotency key for safe retries",
      },
    },
  },
  security: [
    { BearerAuth: [] },
  ],
});

// Scalar UI documentation
openApiApp.get("/api/docs", Scalar({ url: "/api/json", theme: "kepler" }));

// Redoc alternative
openApiApp.get("/api/redoc", (c) => {
  const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Aura Space API - ReDoc</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <redoc spec-url="/api/json"></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js"></script>
  </body>
</html>
  `;
  return c.html(html);
});

export default openApiApp;