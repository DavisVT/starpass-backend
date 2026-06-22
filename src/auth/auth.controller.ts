import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('challenge')
  @Throttle({ 'auth-nonce': { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Get a challenge message to sign with your Stellar keypair' })
  @ApiResponse({ status: 200, description: 'Challenge message generated successfully' })
  @ApiResponse({ status: 429, description: 'Too many requests, rate limit exceeded' })
  getChallenge(@Query('address') address: string) {
    return { challenge: this.authService.getChallenge(address) };
  }

  @Post('login')
  @Throttle({ 'auth-login': { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with a signed Stellar challenge' })
  @ApiResponse({ status: 201, description: 'Login successful, returns JWT access token' })
  @ApiResponse({ status: 401, description: 'Invalid signature or challenge' })
  @ApiResponse({ status: 429, description: 'Too many requests, rate limit exceeded' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.stellarAddress, dto.signature, dto.message);
  }
}
