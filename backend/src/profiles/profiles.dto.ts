import { ArrayMaxSize, IsArray, IsInt, IsMongoId, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsMongoId()
  dealId: string;

  @IsInt({ message: 'Оцінка — ціле число від 1 до 5' })
  @Min(1, { message: 'Оцінка — від 1 до 5' })
  @Max(5, { message: 'Оцінка — від 1 до 5' })
  rating: number;

  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags: string[];
}
