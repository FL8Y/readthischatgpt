import React from 'react';
import type { AppState } from '../../core/types';
import { buildHomeSummary } from '../../bank/home';
import { computeStreak } from '../../bank/streak';
import { dueItems } from '../../bank/requeue';
import { Dashboard } from '../Dashboard';
import { Stats } from './Stats';
import { useBank } from './BankProvider';

type Go = React.ComponentProps<typeof Dashboard>['go'];

/** Home: the Today card is fed from the bank store. */
export function HomeScreen({ state, go }: { state: AppState; go: Go }) {
  const bank = useBank();
  const practice = bank.ready
    ? buildHomeSummary({
        attempts: bank.attempts,
        items: bank.items,
        today: bank.today,
        goal: { perDay: bank.state.dailyGoal },
        requeueDue: dueItems(bank.state.requeue, bank.today).length,
      })
    : undefined;
  return <Dashboard state={state} go={go} practice={practice} onStartPractice={() => go('study')} onOpenStats={() => go('stats')} />;
}

/** Stats tab: reads attempts and items from the bank store. */
export function StatsScreen({ go }: { go: Go }) {
  const bank = useBank();
  return (
    <Stats
      attempts={bank.attempts}
      items={bank.items}
      today={bank.today}
      goal={{ perDay: bank.state.dailyGoal }}
      streak={computeStreak(bank.attempts, bank.today)}
      onPracticeTopic={() => go('study')}
    />
  );
}
