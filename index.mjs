import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({ region: "us-east-1" });
const ddbDocClient = DynamoDBDocumentClient.from(client);

// Utility to create standard responses
const createResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

// POST /wishlist/item handler
const addWishlistItem = async (event) => {
  const requestBody = JSON.parse(event.body);
  const { item, link, price, notes, name } = requestBody;

  if (!item || !link || price === undefined || !name) {
    return createResponse(400, { message: "Missing required fields" });
  }

  const guid = uuidv4();
  const id = `wishlist-item#${guid}`;
  const dynamoItem = {
    id,
    name,
    gsipk: "wishlist-item",
    gsisk: `wishlist-item#${name}`,
    item,
    link,
    price,
    notes,
  };

  await ddbDocClient.send(
    new PutCommand({ TableName: "SiblingsGiftExchange", Item: dynamoItem })
  );

  return createResponse(201, { message: "Item added successfully", itemId: id });
};

// DELETE /wishlist/item/{id} handler
const deleteWishlistItem = async (event) => {
  const id = `wishlist-item#${event.pathParameters?.id}`;
  if (!id) {
    return createResponse(400, { message: "Missing required parameter: id" });
  }

  await ddbDocClient.send(
    new DeleteCommand({
      TableName: "SiblingsGiftExchange",
      Key: { id },
    })
  );

  return createResponse(200, { message: "Item deleted successfully" });
};

// GET /wishlist/{name} handler
const getWishlistItems = async (event) => {
  const name = event.pathParameters?.name;
  if (!name) {
    return createResponse(400, { message: "Missing required parameter: name" });
  }

  const queryResult = await ddbDocClient.send(
    new QueryCommand({
      TableName: "SiblingsGiftExchange",
      IndexName: "gsipk-gsisk-index",
      KeyConditionExpression: "gsipk = :gsipk AND gsisk = :gsisk",
      ExpressionAttributeValues: {
        ":gsipk": "wishlist-item",
        ":gsisk": `wishlist-item#${name}`,
      },
    })
  );

  return createResponse(200, {
    id: queryResult.id,
    items: queryResult.Items || [],
  });
};

// GET /wishlist/exchange/{id} handler
const getExchangeById = async (event) => {
  const id = event.pathParameters?.id;
  if (!id) {
    return createResponse(400, { message: "Missing required parameter: id" });
  }

  const queryResult = await ddbDocClient.send(
    new QueryCommand({
      TableName: "SiblingsGiftExchange",
      KeyConditionExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": `exchange#${id}`,
      },
    })
  );

  if (!queryResult.Items || queryResult.Items.length === 0) {
    return createResponse(404, { message: "Exchange not found" });
  }

  // Assuming only one item should match the pk, return the first one
  return createResponse(200, queryResult.Items[0]);
};

// Main Lambda handler with route dispatching
export const handler = async (event) => {
  try {
    const routeKey = event.routeKey;

    const routes = {
      "POST /wishlist/item": addWishlistItem,
      "GET /wishlist/{name}": getWishlistItems,
      "DELETE /wishlist/item/{id}": deleteWishlistItem,
      "GET /wishlist/exchange/{id}": getExchangeById,
    };

    const routeHandler = routes[routeKey];
    if (!routeHandler) {
      return createResponse(404, { message: "Route not found" });
    }

    return await routeHandler(event);
  } catch (error) {
    console.error("Error processing request:", error);
    return createResponse(500, { message: "Internal server error", error: error.message });
  }
};