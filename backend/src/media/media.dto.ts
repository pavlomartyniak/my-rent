import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UploadSignatureDto {
  /** Скільки фото завантажуватиметься: на кожне видається свій підпис зі своїм публічним ідентифікатором */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number;
}

export class DiscardDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  urls: string[];
}
