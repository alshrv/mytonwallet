import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { ActiveTab, ContentTab } from '../../global/types';

import { IS_CAPACITOR } from '../../config';
import { selectCurrentAccount, selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { getStatusBarHeight } from '../../util/capacitor';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
import { setStatusBarStyle } from '../../util/switchTheme';
import { IS_DELEGATED_BOTTOM_SHEET, IS_TOUCH_ENV, REM } from '../../util/windowEnvironment';
import windowSize from '../../util/windowSize';

import { useOpenFromMainBottomSheet } from '../../hooks/useDelegatedBottomSheet';
import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useEffectOnce from '../../hooks/useEffectOnce';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import ReceiveModal from '../receive/ReceiveModal';
import StakeModal from '../staking/StakeModal';
import StakingInfoModal from '../staking/StakingInfoModal';
import UnstakeModal from '../staking/UnstakeModal';
import { LandscapeActions, PortraitActions } from './sections/Actions';
import Card from './sections/Card';
import StickyCard from './sections/Card/StickyCard';
import Content from './sections/Content';
import Warnings from './sections/Warnings';

import styles from './Main.module.scss';

interface OwnProps {
  isActive?: boolean;
  onQrScanPress?: NoneToVoidFunction;
}

type StateProps = {
  currentTokenSlug?: string;
  isStakingActive: boolean;
  isUnstakeRequested?: boolean;
  isTestnet?: boolean;
  isLedger?: boolean;
  isStakingInfoModalOpen?: boolean;
  isSwapDisabled?: boolean;
  isOnRampDisabled?: boolean;
};

const STICKY_CARD_INTERSECTION_THRESHOLD = -3.75 * REM;

function Main({
  isActive,
  currentTokenSlug,
  isStakingActive,
  isUnstakeRequested,
  isTestnet,
  isLedger,
  onQrScanPress,
  isStakingInfoModalOpen,
  isSwapDisabled,
  isOnRampDisabled,
}: OwnProps & StateProps) {
  const {
    selectToken,
    startStaking,
    openBackupWalletModal,
    setActiveContentTab,
    openStakingInfo,
    closeStakingInfo,
    setLandscapeActionsActiveTabIndex,
    loadDappCatalog,
    openReceiveModal,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const cardRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const portraitContainerRef = useRef<HTMLDivElement>(null);
  const [canRenderStickyCard, setCanRenderStickyCard] = useState(false);
  const [shouldRenderDarkStatusBar, setShouldRenderDarkStatusBar] = useState(false);
  const safeAreaTop = IS_CAPACITOR ? getStatusBarHeight() : windowSize.get().safeAreaTop;

  useOpenFromMainBottomSheet('receive', openReceiveModal);

  const { isPortrait } = useDeviceScreen();
  const {
    shouldRender: shouldRenderStickyCard,
    transitionClassNames: stickyCardTransitionClassNames,
  } = useShowTransition(canRenderStickyCard);

  useEffectOnce(() => {
    loadDappCatalog();
  });

  useEffect(() => {
    setStatusBarStyle(shouldRenderDarkStatusBar);
  }, [shouldRenderDarkStatusBar]);

  useEffect(() => {
    if (!isPortrait || !isActive) {
      setCanRenderStickyCard(false);
      return undefined;
    }

    const rootMarginTop = STICKY_CARD_INTERSECTION_THRESHOLD - safeAreaTop;
    const observer = new IntersectionObserver((entries) => {
      const { isIntersecting, boundingClientRect: { left, width } } = entries[0];
      setCanRenderStickyCard(entries.length > 0 && !isIntersecting && left < width);
    }, { rootMargin: `${rootMarginTop}px 0px 0px` });

    const cardTopSideObserver = new IntersectionObserver((entries) => {
      const { isIntersecting } = entries[0];

      setShouldRenderDarkStatusBar(!isIntersecting);
    }, { rootMargin: `-${safeAreaTop}px 0px 0px`, threshold: [1] });
    const cardElement = cardRef.current;

    if (cardElement) {
      observer.observe(cardElement);
      cardTopSideObserver.observe(cardElement);
    }

    return () => {
      if (cardElement) {
        observer.unobserve(cardElement);
        cardTopSideObserver.unobserve(cardElement);
      }
    };
  }, [isActive, isPortrait, safeAreaTop]);

  const handleTokenCardClose = useLastCallback(() => {
    selectToken({ slug: undefined });
    setActiveContentTab({ tab: ContentTab.Assets });
  });

  useEffect(() => {
    if (!IS_TOUCH_ENV || !isPortrait || !portraitContainerRef.current || !currentTokenSlug) {
      return undefined;
    }

    return captureEvents(portraitContainerRef.current!, {
      excludedClosestSelector: '.token-card',
      onSwipe: (e, direction) => {
        if (direction === SwipeDirection.Right) {
          handleTokenCardClose();
          return true;
        }

        return false;
      },
    });
  }, [currentTokenSlug, handleTokenCardClose, isPortrait]);

  const handleEarnClick = useLastCallback(() => {
    if (!isPortrait) {
      setLandscapeActionsActiveTabIndex({ index: ActiveTab.Stake });
      return;
    }

    if (isStakingActive || isUnstakeRequested) {
      openStakingInfo();
    } else {
      startStaking();
    }
  });

  function renderPortraitLayout() {
    return (
      <div className={styles.portraitContainer} ref={portraitContainerRef}>
        <div className={styles.head}>
          <Warnings onOpenBackupWallet={openBackupWalletModal} />
          <Card
            ref={cardRef}
            forceCloseAccountSelector={shouldRenderStickyCard}
            onTokenCardClose={handleTokenCardClose}
            onApyClick={handleEarnClick}
            onQrScanPress={onQrScanPress}
          />
          {shouldRenderStickyCard && (
            <StickyCard
              classNames={stickyCardTransitionClassNames}
              onQrScanPress={onQrScanPress}
            />
          )}
          <PortraitActions
            hasStaking={isStakingActive}
            isTestnet={isTestnet}
            isUnstakeRequested={isUnstakeRequested}
            onEarnClick={handleEarnClick}
            isLedger={isLedger}
            isSwapDisabled={isSwapDisabled}
            isOnRampDisabled={isOnRampDisabled}
          />
        </div>

        <Content onStakedTokenClick={handleEarnClick} />
      </div>
    );
  }

  function renderLandscapeLayout() {
    return (
      <div className={styles.landscapeContainer}>
        <div className={buildClassName(styles.sidebar, 'custom-scroll')}>
          <Warnings onOpenBackupWallet={openBackupWalletModal} />
          <Card onTokenCardClose={handleTokenCardClose} onApyClick={handleEarnClick} onQrScanPress={onQrScanPress} />
          <LandscapeActions
            hasStaking={isStakingActive}
            isUnstakeRequested={isUnstakeRequested}
            isLedger={isLedger}
          />
        </div>
        <div className={styles.main}>
          <Content onStakedTokenClick={handleEarnClick} />
        </div>
      </div>
    );
  }

  return (
    <>
      {!IS_DELEGATED_BOTTOM_SHEET && (isPortrait ? renderPortraitLayout() : renderLandscapeLayout())}

      <StakeModal />
      <StakingInfoModal isOpen={isStakingInfoModalOpen} onClose={closeStakingInfo} />
      <ReceiveModal />
      <UnstakeModal />
    </>
  );
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const accountState = selectCurrentAccountState(global);
      const account = selectCurrentAccount(global);

      const { isSwapDisabled, isOnRampDisabled } = global.restrictions;

      return {
        isStakingActive: Boolean(accountState?.staking?.balance),
        isUnstakeRequested: accountState?.staking?.isUnstakeRequested,
        currentTokenSlug: accountState?.currentTokenSlug,
        isTestnet: global.settings.isTestnet,
        isLedger: !!account?.ledger,
        isStakingInfoModalOpen: global.isStakingInfoModalOpen,
        isSwapDisabled,
        isOnRampDisabled,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(Main),
);
