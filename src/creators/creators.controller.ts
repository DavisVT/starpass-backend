import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreatorsService } from './creators.service';
import { CreateCreatorDto } from './dto/create-creator.dto';
import { UpdateCreatorDto } from './dto/update-creator.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WebhooksService } from '../webhooks/webhooks.service';
import { RegisterWebhookDto } from '../webhooks/dto/register-webhook.dto';

@ApiTags('creators')
@Controller('creators')
export class CreatorsController {
  constructor(
    private creatorsService: CreatorsService,
    private webhooksService: WebhooksService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all creators' })
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.creatorsService.findAll(+page, +limit);
  }

  @Get(':address')
  @ApiOperation({ summary: 'Get creator by Stellar address' })
  findOne(@Param('address') address: string) {
    return this.creatorsService.findByAddress(address);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register as a creator' })
  register(@Request() req: any, @Body() dto: CreateCreatorDto) {
    return this.creatorsService.register(req.user.sub, dto, req.user.address);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update creator profile' })
  update(@Request() req: any, @Body() dto: UpdateCreatorDto) {
    return this.creatorsService.update(req.user.address, dto);
  }

  @Get(':address/earnings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get creator earnings summary' })
  getEarnings(@Param('address') address: string) {
    return this.creatorsService.getEarnings(address);
  }

  @Post(':id/webhooks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a webhook URL' })
  registerWebhook(
    @Param('id') id: string,
    @Body() dto: RegisterWebhookDto,
  ) {
    return this.webhooksService.register(id, dto.url, dto.secret);
  }

  @Delete(':id/webhooks/:webhookId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a webhook' })
  removeWebhook(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.remove(id, webhookId);
  }
}
