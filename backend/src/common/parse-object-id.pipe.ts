import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

/** Перевіряє ObjectId; для необов'язкових query-параметрів `undefined` пропускає */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string | undefined, string | undefined> {
  transform(value: string | undefined) {
    if (value === undefined) return value;
    if (!/^[a-f\d]{24}$/i.test(value) || !isValidObjectId(value)) throw new BadRequestException('Невірний id');
    return value;
  }
}
