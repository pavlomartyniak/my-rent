import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';

import { MAX_MESSAGE_LENGTH } from './chat.math';

/** Відкрити чат у контексті запиту, пропозиції чи оренди: потрібен рівно один із них */
export class OpenChatDto {
  @IsOptional()
  @IsMongoId()
  rentalId?: string;

  @IsOptional()
  @IsMongoId()
  offerId?: string;

  @IsOptional()
  @IsMongoId()
  dealId?: string;
}

export class AttachmentDto {
  /** Посилання на фото чи відео в хмарі */
  @IsOptional()
  @IsString()
  @MaxLength(600)
  url?: string;

  /** Файл, завантажений на сервер через POST /chats/:id/files */
  @IsOptional()
  @IsMongoId()
  fileId?: string;

  @IsString()
  @MaxLength(300)
  name: string;

  @IsInt()
  @Min(0)
  @Max(200 * 1024 * 1024)
  size: number;
}

export class SendMessageDto {
  /** Вкладення (фото, відео, файли), завантажені в хмару; текст тоді може бути порожнім */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(MAX_MESSAGE_LENGTH, { message: `Повідомлення задовге (до ${MAX_MESSAGE_LENGTH} символів)` })
  text?: string;

  /** Унікальний id від застосунку: захищає від дублів при повторній відправці */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientId?: string;
}

export class MessagesQuery {
  /** id найстарішого вже завантаженого повідомлення: віддаємо ті, що раніше */
  @ValidateIf((_, v) => v !== undefined)
  @IsMongoId()
  before?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 40;
}
