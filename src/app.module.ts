import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ImageModule } from './image/image.module';
import { ConfigModule } from './config/config.module';

@Module({
  imports: [ConfigModule, ImageModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
