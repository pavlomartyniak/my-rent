import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

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

export class SendMessageDto {
  @IsString()
  @MaxLength(MAX_MESSAGE_LENGTH, { message: `Повідомлення задовге (до ${MAX_MESSAGE_LENGTH} символів)` })
  text: string;

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
