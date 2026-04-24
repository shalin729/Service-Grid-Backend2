const request = require("supertest");
const app = require("./index");

describe("GET /", () => {
  it("should return API is running message", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain("Nexus Service Grid API is running...");
  });
});
