import React from 'react';
import fs from 'fs';
import path from 'path';
import { Alert } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { services } from '@app/services/service';
import { useSendRemovalRequest } from '@app/hooks/useRemovalRequest';
import { RemovalRequest } from '@app/types/types';

describe('Removal requests worker-centered audit guard (spec 0035, AC-22, value 5)', () => {
  describe('(a) No artificial cap: rider can send repeatedly without limits or warnings', () => {
    let queryClient: QueryClient;
    let alertSpy: jest.SpyInstance;

    const createWrapper = () => {
      queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
          mutations: { retry: false, gcTime: Infinity },
        },
      });
      return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          children,
        );
    };

    beforeEach(() => {
      jest.clearAllMocks();
      alertSpy = jest.spyOn(Alert, 'alert');
    });

    afterEach(() => {
      alertSpy.mockRestore();
      queryClient?.clear();
    });

    it('allows several sends for the same delivery one after another, all reaching the service with no cap and no alert', async () => {
      const wrapper = createWrapper();

      const sendSpy = jest
        .spyOn(services.orderService, 'sendRemovalRequest')
        .mockImplementation(async params => {
          return {
            id: `req-${params.reasonId}`,
            status: 'OPEN',
            label: 'Test reason',
            paid: true,
            decisionNote: null,
            createdAt: new Date().toISOString(),
          } as RemovalRequest;
        });

      const { result } = renderHook(() => useSendRemovalRequest(), { wrapper });
      const onSent = jest.fn();

      // Send 5 times in a row, allowing each to complete (e.g. after a decline or withdrawal)
      const sendCount = 5;
      for (let i = 1; i <= sendCount; i++) {
        await act(async () => {
          result.current.send(
            {
              orderId: 'del-repeat-test',
              reasonId: `reason-${i}`,
              note: `Attempt ${i}`,
            },
            onSent,
          );
        });
      }

      // All 5 reached the service without being capped
      expect(sendSpy).toHaveBeenCalledTimes(sendCount);
      expect(onSent).toHaveBeenCalledTimes(sendCount);

      // No warning, strike, or cap alert was presented to the rider
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });

  describe('(b) Source guard: removal request code must never read rider position (AC-22, value 5)', () => {
    const srcDir = path.resolve(__dirname, '..');
    const hookFile = path.join(srcDir, 'hooks/useRemovalRequest.ts');
    const screenFile = path.join(
      srcDir,
      'screens/RequestRemoval/RequestRemoval.tsx',
    );
    const orderServiceFile = path.join(srcDir, 'services/orderService.ts');

    const forbiddenPatterns = [
      { name: 'latestFix', regex: /\blatestFix\b/ },
      { name: 'ownPosition', regex: /\bownPosition\b/ },
      { name: 'Geolocation', regex: /\bGeolocation\b/ },
      { name: 'getCurrentPosition', regex: /\bgetCurrentPosition\b/ },
      { name: 'watchPosition', regex: /\bwatchPosition\b/ },
      { name: 'latitude', regex: /\blatitude\b/ },
      { name: 'longitude', regex: /\blongitude\b/ },
      { name: 'coords', regex: /\bcoords\b/ },
    ];

    it('useRemovalRequest.ts does not read rider position or coordinates', () => {
      const content = fs.readFileSync(hookFile, 'utf-8');
      const lines = content.split('\n');
      const violations: string[] = [];

      lines.forEach((line, index) => {
        for (const pattern of forbiddenPatterns) {
          if (pattern.regex.test(line)) {
            violations.push(
              `useRemovalRequest.ts:${index + 1}: found forbidden pattern '${
                pattern.name
              }': ${line.trim()}`,
            );
          }
        }
      });

      expect(violations).toEqual([]);
    });

    it('RequestRemoval.tsx does not read rider position or coordinates', () => {
      const content = fs.readFileSync(screenFile, 'utf-8');
      const lines = content.split('\n');
      const violations: string[] = [];

      lines.forEach((line, index) => {
        for (const pattern of forbiddenPatterns) {
          if (pattern.regex.test(line)) {
            violations.push(
              `RequestRemoval.tsx:${index + 1}: found forbidden pattern '${
                pattern.name
              }': ${line.trim()}`,
            );
          }
        }
      });

      expect(violations).toEqual([]);
    });

    it('sendRemovalRequest in orderService.ts does not include rider position or coordinates', () => {
      const content = fs.readFileSync(orderServiceFile, 'utf-8');
      const match = content.match(
        /const sendRemovalRequest = async \([\s\S]*?\n {2}\};/,
      );
      expect(match).toBeTruthy();

      const functionCode = match![0];
      const lines = functionCode.split('\n');
      const violations: string[] = [];

      lines.forEach((line, index) => {
        for (const pattern of forbiddenPatterns) {
          if (pattern.regex.test(line)) {
            violations.push(
              `orderService.ts sendRemovalRequest:${
                index + 1
              }: found forbidden pattern '${pattern.name}': ${line.trim()}`,
            );
          }
        }
      });

      expect(violations).toEqual([]);
    });
  });
});
