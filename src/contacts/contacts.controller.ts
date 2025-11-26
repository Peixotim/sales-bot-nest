import { Controller, Get, Body, Post, Param, Delete } from '@nestjs/common';
import { ContactService } from './contacts.service';
import { BlockContactDto } from './dto/block-contact.dto';

@Controller('contacts')
export class ContactController {
  constructor(private readonly contactsService: ContactService) {}
  @Get('blacklist')
  public async getBlackList() {
    return await this.contactsService.findAllBlocks();
  }

  @Post('block')
  public async block(@Body() request: BlockContactDto) {
    return await this.contactsService.blockContact(
      request.phoneNumber,
      request.name,
    );
  }

  @Get(':phone')
  public async getPhone(@Param('phone') phone: string) {
    return await this.contactsService.findOneBlock(phone);
  }

  @Delete('unblock/:phone')
  public async unblock(@Param('phone') phone: string) {
    return await this.contactsService.unblockContact(phone);
  }
}
