# Uma Crown Simulator - ボイラープレートテンプレート

**新規ファイルを作成するときは必ずこのテンプレートから始める。**

---

## 目次

1. [Service テンプレート](#1-service-テンプレート)
2. [Controller テンプレート](#2-controller-テンプレート)
3. [Request DTO テンプレート](#3-request-dto-テンプレート)
4. [Response DTO テンプレート](#4-response-dto-テンプレート)
5. [Mapper テンプレート](#5-mapper-テンプレート)
6. [カスタム例外の使用例](#6-カスタム例外の使用例)
7. [ディレクトリ配置ルール](#7-ディレクトリ配置ルール)

---

## 1. Service テンプレート

```typescript
// backend/src/<module>/<module>.service.ts
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service.js';
import { DatabaseException } from '../common/exceptions/database.exception.js';
import { ErrorCode } from '../common/constants/error-code.constant.js';
import { handlePrismaError } from '../common/utils/prisma-error.handler.js';
import { XxxResponse } from '../../shared/dto/response/xxx.response.js';
import { toXxxResponse } from './xxx.mapper.js';

/**
 * XXX サービス
 *
 * 担当: XXX のビジネスロジックと Prisma 操作
 * 禁止: HTTP の知識（req/res）・直接レスポンス生成・try-catch なしの Prisma 呼び出し
 *
 * （責務の概要を1〜2文で記述する）
 */
@Injectable()
export class XxxService {
  constructor(
    @InjectPinoLogger(XxxService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * XXX 一覧を返す
   * @param userId - Cognito ユーザー ID
   * @returns XXX 配列
   * @throws DatabaseException DB 取得に失敗した場合
   */
  async findAll(userId: string): Promise<XxxResponse[]> {
    let rows;
    try {
      rows = await this.prisma.xxxTable.findMany({ where: { user_id: userId } });
    } catch (err) {
      handlePrismaError(err, 'XxxService.findAll');
    }
    this.logger.log({ userId }, 'XXX 一覧を取得しました');
    return rows.map(toXxxResponse);
  }
}
```

---

## 2. Controller テンプレート

```typescript
// backend/src/<module>/<module>.controller.ts
import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { XxxService } from './xxx.service.js';
import { CreateXxxDto } from './dto/create-xxx.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { XxxResponse } from '../../shared/dto/response/xxx.response.js';

/**
 * XXX コントローラー
 *
 * 担当: /xxx エンドポイントの定義・HTTP I/O・パラメータのバインディング
 * 禁止: ビジネスロジック・DB アクセス・try-catch・認証処理
 */
@Controller('xxx')
export class XxxController {
  constructor(private readonly xxxService: XxxService) {}

  /**
   * XXX 一覧を取得する
   * @param userId - 認証済みユーザー ID
   * @returns XXX 配列
   */
  @Get()
  async findAll(@CurrentUser() userId: string): Promise<XxxResponse[]> {
    return this.xxxService.findAll(userId);
  }

  /**
   * XXX を作成する
   * @param dto - 作成リクエスト
   * @param userId - 認証済みユーザー ID
   * @returns 作成した XXX
   */
  @Post()
  async create(
    @Body() dto: CreateXxxDto,
    @CurrentUser() userId: string,
  ): Promise<XxxResponse> {
    return this.xxxService.create(dto, userId);
  }
}
```

---

## 3. Request DTO テンプレート

```typescript
// backend/src/<module>/dto/create-xxx.dto.ts
import { IsInt, IsString, Min, MaxLength, IsNotEmpty } from 'class-validator';

/**
 * XXX 作成リクエスト DTO
 */
export class CreateXxxDto {
  /** XXX ID */
  @IsInt()
  @Min(1)
  xxxId: number;

  /** XXX 名 */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  xxxName: string;
}
```

---

## 4. Response DTO テンプレート

```typescript
// shared/dto/response/xxx.response.ts

/**
 * XXX レスポンス DTO
 *
 * フロントエンド・バックエンド共通の型定義。
 * Prisma モデルを直接使わず、このインターフェースに変換して返す。
 * optional フィールドは undefined ではなく null を使う。
 */
export interface XxxResponse {
  xxxId: number;
  xxxName: string;
  description: string | null;  // optional フィールドは null で表現する
}
```

---

## 5. Mapper テンプレート

```typescript
// backend/src/<module>/xxx.mapper.ts
import { XxxTable } from '@prisma/client';
import { XxxResponse } from '../../shared/dto/response/xxx.response.js';

/**
 * Prisma モデルを Response DTO に変換する
 * @param row - Prisma から取得したレコード
 * @returns Response DTO
 */
export function toXxxResponse(row: XxxTable): XxxResponse {
  return {
    xxxId: row.xxx_id,
    xxxName: row.xxx_name,
    description: row.description,  // null のまま渡す（undefined に変換しない）
  };
}
```

---

## 6. カスタム例外の使用例

```typescript
// DatabaseException（DB 操作失敗）
throw new DatabaseException(
  'XXX の取得に失敗しました',       // ログ用日本語メッセージ
  'XxxService.methodName',          // 発生箇所 'ClassName.methodName' 形式
  ErrorCode.DB_QUERY_FAILED,        // エラーコード（→ backend/index.md §4）
  originalError,                    // 原因となった例外（スタックトレース保持）
);

// Prisma エラーは handlePrismaError を使う（→ backend/index.md §9）
try {
  await this.prisma.xxxTable.create({ data });
} catch (err) {
  handlePrismaError(err, 'XxxService.create', {
    conflictErrorCode: ErrorCode.CONFLICT_XXX_ALREADY_EXISTS,
    conflictMessage: 'XXX は既に登録されています',
  });
}
```

---

## 7. ディレクトリ配置ルール

```
backend/src/
├── common/
│   ├── constants/
│   │   └── error-code.constant.ts      # エラーコード定義
│   ├── exceptions/
│   │   ├── database.exception.ts       # DB エラー
│   │   ├── external-api.exception.ts   # 外部 API エラー
│   │   └── business-logic.exception.ts # ビジネスロジックエラー
│   ├── utils/
│   │   └── prisma-error.handler.ts     # Prisma エラー変換ユーティリティ
│   ├── filters/
│   │   └── all-exceptions.filter.ts    # グローバル例外フィルター
│   ├── interceptors/
│   │   └── logging.interceptor.ts      # 処理時間計測など
│   ├── guards/
│   │   └── auth.guard.ts               # JWT 認証
│   └── decorators/
│       ├── current-user.decorator.ts
│       └── public.decorator.ts
└── <module>/
    ├── <module>.controller.ts
    ├── <module>.service.ts
    ├── <module>.mapper.ts              # Prisma → Response DTO 変換
    └── dto/
        ├── create-<module>.dto.ts      # Request DTO
        └── update-<module>.dto.ts

shared/
└── dto/
    └── response/
        ├── error.response.ts           # ErrorResponse 共通型
        ├── race.response.ts
        └── umamusume.response.ts
```
