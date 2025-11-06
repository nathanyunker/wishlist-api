import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });

// Utility function to convert DynamoDB item to plain JSON
const unmarshallItem = (item) => {
  const result = {};
  for (const [key, value] of Object.entries(item)) {
    if (value.S) result[key] = value.S; // Handle string values
    if (value.L) result[key] = value.L.map((v) => v.S); // Handle list of strings
  }
  return result;
};

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { googleId, email, name, picture, exchanges } = body;

    // Validate required fields
    if (!googleId || !email || !name) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing required fields: googleId, email, or name" }),
      };
    }

    // Validate exchanges if provided
    let exchangesList = null;
    if (exchanges !== undefined) {
      if (!Array.isArray(exchanges)) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Exchanges must be an array" }),
        };
      }
      exchangesList = exchanges.map((item) => ({ S: item })); // Convert to DynamoDB list of strings
    }

    // Get current ISO date/time
    const currentTime = new Date().toISOString();

    const params = {
      TableName: "MinervaUsers",
      Key: {
        pk: { S: email },                    // Partition key: email
        sk: { S: `google-user#${googleId}` }, // Sort key: "google-user#" + googleId
      },
      UpdateExpression: `
        SET #name = if_not_exists(#name, :name),
            #lastLogin = :lastLogin
        ${picture ? ", #picture = if_not_exists(#picture, :picture)" : ""}
        ${exchangesList ? ", #exchanges = :exchanges" : ""}
      `,
      ExpressionAttributeNames: {
        "#name": "name",
        "#lastLogin": "lastLogin",
        ...(picture && { "#picture": "picture" }),
        ...(exchangesList && { "#exchanges": "exchanges" }),
      },
      ExpressionAttributeValues: {
        ":name": { S: name },
        ":lastLogin": { S: currentTime },
        ...(picture && { ":picture": { S: picture } }),
        ...(exchangesList && { ":exchanges": { L: exchangesList } }),
      },
      ReturnValues: "ALL_NEW"
    };

    const command = new UpdateItemCommand(params);
    const result = await client.send(command);

    // Convert the DynamoDB item to a plain JSON object
    const updatedItem = unmarshallItem(result.Attributes);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedItem),
    };
  } catch (error) {
    console.error("Error processing request:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};