import { Test, TestingModule } from '@nestjs/testing';
import { CorrectorEngine } from './services/corrector-engine.service';
import { TransformerService } from './services/transformer.service';
import { TargetApiCaller } from './services/target-api-caller.service';
import { AuthStrategyFactory } from './strategies/auth.strategy';
import { MappingConfig } from './interfaces/mapping-config.interface';
import axios from 'axios';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CorrectorAudit } from './entities/corrector-audit.entity';

describe('CorrectorEngine', () => {
  let engine: CorrectorEngine;

  const mockApiCaller = {
    call: jest.fn(),
  };

  const mockAuditRepo = {
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrectorEngine,
        TransformerService,
        AuthStrategyFactory,
        { provide: TargetApiCaller, useValue: mockApiCaller },
        {
          provide: getRepositoryToken(CorrectorAudit),
          useValue: mockAuditRepo,
        },
      ],
    }).compile();

    engine = module.get<CorrectorEngine>(CorrectorEngine);
  });

  it('should transform request, inject auth, call API, and transform response', async () => {
    const mapping: MappingConfig = {
      id: 'test-map',
      sourceSystem: 'A',
      targetSystem: 'B',
      requestMapping: {
        mappings: [{ source: '$.name', target: '$.fullName' }],
      },
      authConfig: {
        type: 'basic',
        username: 'user',
        password: 'pass',
      },
      targetApi: {
        url: 'http://api.com',
        method: 'POST',
      },
      responseMapping: {
        mappings: [{ source: '$.success', target: '$.isOk' }],
      },
    };

    const sourcePayload = { name: 'John Doe' };
    const apiResponse = { success: true };

    mockApiCaller.call.mockResolvedValue(apiResponse);

    const result = await engine.execute(mapping, sourcePayload);

    // Verify API called with transformed payload and auth header
    expect(mockApiCaller.call).toHaveBeenCalledWith(
      mapping.targetApi,
      { fullName: 'John Doe' },
      expect.objectContaining({
        Authorization: expect.stringContaining('Basic') as unknown,
      }),
    );

    // Verify final result transformed
    expect(result).toEqual({ isOk: true });
  });

  it('should handle conditional mapping and transforms', async () => {
    const mapping: MappingConfig = {
      id: 'advanced-map',
      sourceSystem: 'A',
      targetSystem: 'B',
      requestMapping: {
        mappings: [
          {
            source: '$.amount',
            target: '$.total',
            transform: 'roundTo2',
          },
          {
            source: '$.type',
            target: '$.priority',
            condition: "$.type == 'EXPRESS'",
            valueIfTrue: 'HIGH',
            valueIfFalse: 'NORMAL',
          },
          {
            source: '$.user.name',
            target: '$.userName',
            transform: 'uppercase',
          },
        ],
      },
      targetApi: { url: 'http://api.com', method: 'POST' },
    };

    const sourcePayload = {
      amount: 100.555,
      type: 'EXPRESS',
      user: { name: 'alice' },
    };

    mockApiCaller.call.mockResolvedValue({});

    await engine.execute(mapping, sourcePayload);

    expect(mockApiCaller.call).toHaveBeenCalledWith(
      mapping.targetApi,
      {
        total: 100.56, // Rounded
        priority: 'HIGH', // Condition true
        userName: 'ALICE', // Uppercase
      },
      expect.anything(),
    );
  });

  it('should handle API errors and apply error mapping', async () => {
    const mapping: MappingConfig = {
      id: 'error-map',
      sourceSystem: 'A',
      targetSystem: 'B',
      targetApi: { url: 'http://api.com', method: 'POST' },
      errorMapping: {
        mappings: [
          { source: '$.error.code', target: '$.errCode' },
          { source: '$.error.message', target: '$.msg' },
        ],
      },
    };

    const sourcePayload = {};
    const errorResponse = {
      response: {
        status: 400,
        data: {
          error: {
            code: 'INVALID_INPUT',
            message: 'Bad Request',
          },
        },
      },
      message: 'Request failed with status code 400',
    };

    mockApiCaller.call.mockRejectedValue(errorResponse);

    const result = await engine.execute(mapping, sourcePayload);

    expect(result).toEqual({
      errCode: 'INVALID_INPUT',
      msg: 'Bad Request',
    });
  });

  // Mock axios for OAuth2 test
  it('should inject OAuth2 token', async () => {
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({
      data: { access_token: 'mock-access-token', expires_in: 3600 },
    });

    const mapping: MappingConfig = {
      id: 'oauth-map',
      sourceSystem: 'A',
      targetSystem: 'B',
      requestMapping: { mappings: [] },
      authConfig: {
        type: 'oauth2',
        tokenUrl: 'http://auth.com/token',
        clientId: 'client',
        clientSecret: 'secret',
        scope: 'scope',
      },
      targetApi: { url: 'http://api.com', method: 'POST' },
    };

    mockApiCaller.call.mockResolvedValue({});

    await engine.execute(mapping, {});

    expect(postSpy).toHaveBeenCalledWith(
      'http://auth.com/token',
      expect.any(URLSearchParams),
      expect.any(Object),
    );

    expect(mockApiCaller.call).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ Authorization: 'Bearer mock-access-token' }),
    );

    postSpy.mockRestore();
  });
});
