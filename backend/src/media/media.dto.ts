import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadSignatureDto {
  /** Скільки фото завантажуватиметься: на кожне видається свій підпис зі своїм публічним ідентифікатором */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number;
}

/** Файл вкладення чату: вид і розширення (для файлів воно входить у публічний ідентифікатор, щоб браузер відкрив їх правильно) */
export class ChatFileDto {
  @IsIn(['image', 'video', 'file'])
  kind: 'image' | 'video' | 'file';

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]{1,8}$/i, { message: 'Невірне розширення файлу' })
  ext?: string;
}

export class ChatSignatureDto {
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ChatFileDto)
  files: ChatFileDto[];
}

export class DiscardDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  urls: string[];
}
