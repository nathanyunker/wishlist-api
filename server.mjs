import express from "express";
import { handler } from "./index.mjs";
import cors from 'cors';


const app = express();
app.use(express.json());
app.use(cors());

// Simulate API Gateway event structure
const createEvent = (method, path, body, pathParams) => ({
  requestContext: { http: { method } },
  routeKey: `${method} ${path}`,
  body: body ? JSON.stringify(body) : null,
  pathParameters: pathParams || {},
});

app.post("/wishlist/item", async (req, res) => {
  const event = createEvent("POST", "/wishlist/item", req.body);
  const result = await handler(event);
  res.status(result.statusCode).json(JSON.parse(result.body));
});

app.get("/wishlist/:name", async (req, res) => {
  const event = createEvent("GET", "/wishlist/{name}", null, { name: req.params.name });
  const result = await handler(event);
  res.status(result.statusCode).json(JSON.parse(result.body));
});

app.get("/wishlist/exchange/:id", async (req, res) => {
  const event = createEvent("GET", "/wishlist/exchange/{id}", null, { id: req.params.id  });
  const result = await handler(event);
  res.status(result.statusCode).json(JSON.parse(result.body));
});

app.delete("/wishlist/item/:id", async (req, res) => {
  const event = createEvent("DELETE", "/wishlist/item/{id}", null, { id: req.params.id });
  const result = await handler(event);
  res.status(result.statusCode).json(JSON.parse(result.body));
});

app.listen(3001, () => console.log("Server running on http://localhost:3001"));