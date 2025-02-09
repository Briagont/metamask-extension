import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Button } from '../../../components/component-library';
import {
  getFromAmount,
  getFromChain,
  getFromToken,
  getToToken,
  getBridgeQuotes,
  getValidationErrors,
  getBridgeQuotesConfig,
} from '../../../ducks/bridge/selectors';
import { useI18nContext } from '../../../hooks/useI18nContext';
import useSubmitBridgeTransaction from '../hooks/useSubmitBridgeTransaction';
import useLatestBalance from '../../../hooks/bridge/useLatestBalance';
import { useIsTxSubmittable } from '../../../hooks/bridge/useIsTxSubmittable';
import { useCrossChainSwapsEventTracker } from '../../../hooks/bridge/useCrossChainSwapsEventTracker';
import { useRequestProperties } from '../../../hooks/bridge/events/useRequestProperties';
import { useRequestMetadataProperties } from '../../../hooks/bridge/events/useRequestMetadataProperties';
import { useTradeProperties } from '../../../hooks/bridge/events/useTradeProperties';
import { MetaMetricsEventName } from '../../../../shared/constants/metametrics';

export const BridgeCTAButton = () => {
  const t = useI18nContext();

  const fromToken = useSelector(getFromToken);
  const toToken = useSelector(getToToken);

  const fromChain = useSelector(getFromChain);

  const fromAmount = useSelector(getFromAmount);

  const { isLoading, activeQuote, isQuoteGoingToRefresh, quotesRefreshCount } =
    useSelector(getBridgeQuotes);
  const { maxRefreshCount, refreshRate } = useSelector(getBridgeQuotesConfig);

  const { submitBridgeTransaction } = useSubmitBridgeTransaction();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isNoQuotesAvailable, isInsufficientBalance } =
    useSelector(getValidationErrors);

  const { balanceAmount } = useLatestBalance(fromToken, fromChain?.chainId);

  const isTxSubmittable = useIsTxSubmittable();
  const trackCrossChainSwapsEvent = useCrossChainSwapsEventTracker();
  const { quoteRequestProperties } = useRequestProperties();
  const requestMetadataProperties = useRequestMetadataProperties();
  const tradeProperties = useTradeProperties();

  const [isQuoteExpired, setIsQuoteExpired] = useState(false);
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    // Reset the isQuoteExpired if quote fethching restarts
    if (quotesRefreshCount === 0) {
      setIsQuoteExpired(false);
      return () => clearTimeout(timeout);
    }
    // After the last quote refresh, set a timeout to expire the quote and disable the CTA
    if (quotesRefreshCount >= maxRefreshCount && !isQuoteGoingToRefresh) {
      timeout = setTimeout(() => {
        setIsQuoteExpired(true);
      }, refreshRate);
    }
    return () => clearTimeout(timeout);
  }, [isQuoteGoingToRefresh, quotesRefreshCount]);

  const label = useMemo(() => {
    if (isQuoteExpired) {
      return t('bridgeQuoteExpired');
    }

    if (isLoading && !isTxSubmittable) {
      return t('swapFetchingQuotes');
    }

    if (isNoQuotesAvailable) {
      return t('swapQuotesNotAvailableErrorTitle');
    }

    if (isInsufficientBalance(balanceAmount)) {
      return t('alertReasonInsufficientBalance');
    }

    if (!fromAmount) {
      if (!toToken) {
        return t('bridgeSelectTokenAndAmount');
      }
      return t('bridgeEnterAmount');
    }

    if (isTxSubmittable) {
      return t('confirm');
    }

    return t('swapSelectToken');
  }, [
    isLoading,
    fromAmount,
    toToken,
    isTxSubmittable,
    balanceAmount,
    isInsufficientBalance,
    isQuoteExpired,
  ]);

  return (
    <Button
      data-testid="bridge-cta-button"
      onClick={() => {
        if (activeQuote && isTxSubmittable) {
          try {
            // We don't need to worry about setting to false if the tx submission succeeds
            // because we route immediately to Activity list page
            setIsSubmitting(true);

            quoteRequestProperties &&
              requestMetadataProperties &&
              tradeProperties &&
              trackCrossChainSwapsEvent({
                event: MetaMetricsEventName.ActionSubmitted,
                properties: {
                  ...quoteRequestProperties,
                  ...requestMetadataProperties,
                  ...tradeProperties,
                },
              });
            submitBridgeTransaction(activeQuote);
          } finally {
            setIsSubmitting(false);
          }
        }
      }}
      loading={isSubmitting}
      disabled={!isTxSubmittable || isQuoteExpired || isSubmitting}
    >
      {label}
    </Button>
  );
};
