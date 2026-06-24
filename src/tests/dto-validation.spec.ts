import { Test, TestingModule } from "@nestjs/testing";
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
  Controller,
  Post,
  Body,
  HttpCode,
} from "@nestjs/common";
import * as request from "supertest";

import { LoginDto } from "../auth/dto/login.dto";
import { BlockFanDto } from "../creators/dto/block-fan.dto";
import { BulkCreateTiersDto } from "../tiers/dto/bulk-create-tiers.dto";

@Controller({ path: "auth", version: "1" })
class TestAuthController {
  @Post("login")
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return { success: true };
  }
}

@Controller({ path: "creators", version: "1" })
class TestCreatorsController {
  @Post("block")
  @HttpCode(200)
  block(@Body() dto: BlockFanDto) {
    return { success: true };
  }
}

@Controller({ path: "tiers", version: "1" })
class TestTiersController {
  @Post("bulk")
  @HttpCode(200)
  bulk(@Body() dto: BulkCreateTiersDto) {
    return { success: true };
  }
}

describe("DTO Validation (E2E)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        TestAuthController,
        TestCreatorsController,
        TestTiersController,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.enableVersioning({ type: VersioningType.URI });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /v1/auth/login (LoginDto)", () => {
    it("should return 400 if fields are missing or empty strings", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/login")
        .send({
          stellarAddress: "",
          message: "challenge_text",
        })
        .expect(400);

      expect(response.body.message).toContain(
        "stellarAddress should not be empty",
      );
      expect(response.body.message).toContain("signature should not be empty");
    });
  });

  describe("POST /v1/creators/block (BlockFanDto)", () => {
    it("should return 400 if fan address is missing or block reason exceeds max length", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/creators/block")
        .send({
          reason: "a".repeat(501),
        })
        .expect(400);

      expect(response.body.message).toContain("fanAddress should not be empty");
      expect(response.body.message).toContain(
        "reason must be shorter than or equal to 500 characters",
      );
    });
  });

  describe("POST /v1/tiers/bulk (BulkCreateTiersDto)", () => {
    it("should return 400 if an unknown property is sent (forbidNonWhitelisted)", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/tiers/bulk")
        .send({
          tiers: [],
          maliciousPayload: "hack",
        })
        .expect(400);

      expect(response.body.message).toContain(
        "property maliciousPayload should not exist",
      );
    });
  });
});
