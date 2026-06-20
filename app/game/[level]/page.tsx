'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import styles from '../game.module.css';
import { Question, SubmitAnswer, SubmitGameResponse, AnswerKeyItem } from '@/lib/types';
import { getClientLocale, Locale, t } from '@/lib/i18n';

const TIMER_SECONDS = 15;

type GamePhase = 'loading' | 'playing' | 'feedback' | 'results' | 'error';

export default function GamePage() {
  const params = useParams();
  const level = parseInt(params.level as string, 10);

  const [locale, setLocale] = useState<Locale>('en');
  const [phase, setPhase] = useState<GamePhase>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<SubmitAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [errorMsg, setErrorMsg] = useState('');
  const [results, setResults] = useState<SubmitGameResponse | null>(null);
  const [score, setScore] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocale(getClientLocale());
  }, []);

  // Load questions
  useEffect(() => {
    if (isNaN(level)) {
      setErrorMsg(t(getClientLocale(), 'invalidLevel'));
      setPhase('error');
      return;
    }

    fetch(`/api/game/start?level=${level}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setErrorMsg(data.error);
          setPhase('error');
          return;
        }
        setQuestions(data.questions);
        setPhase('playing');
      })
      .catch(() => {
        setErrorMsg(t(getClientLocale(), 'failedLoad'));
        setPhase('error');
      });
  }, [level]);

  const advanceQuestion = useCallback(
    (answerList: SubmitAnswer[]) => {
      const nextIndex = answerList.length;
      if (nextIndex >= questions.length) {
        // Submit answers
        setPhase('loading');
        fetch('/api/game/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level, answers: answerList }),
        })
          .then((r) => r.json())
          .then((data: SubmitGameResponse) => {
            setResults(data);
            setPhase('results');
          })
          .catch(() => {
            setErrorMsg(t(getClientLocale(), 'failedSubmit'));
            setPhase('error');
          });
        return;
      }
      setCurrentIndex(nextIndex);
      setSelectedAnswer(null);
      setTimeLeft(TIMER_SECONDS);
      setPhase('playing');
    },
    [questions.length, level]
  );

  const handleAnswer = useCallback(
    (answer: string | null) => {
      if (phase !== 'playing') return;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setSelectedAnswer(answer);
      setPhase('feedback');

      const question = questions[currentIndex];
      const newAnswer: SubmitAnswer = { countryId: question.countryId, answer };
      const newAnswers = [...answers, newAnswer];
      setAnswers(newAnswers);

      if (answer !== null && answer === question.correctOption) {
        setScore((s) => s + 1);
      }

      feedbackTimeoutRef.current = setTimeout(() => {
        advanceQuestion(newAnswers);
      }, 800);
    },
    [phase, questions, currentIndex, answers, advanceQuestion]
  );

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return;

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAnswer(null); // timeout
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, currentIndex, handleAnswer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const resetAndReload = useCallback(() => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setResults(null);
    setAnswers([]);
    setCurrentIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setTimeLeft(TIMER_SECONDS);
    setErrorMsg('');
    setPhase('loading');
    fetch(`/api/game/start?level=${level}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setErrorMsg(data.error); setPhase('error'); return; }
        setQuestions(data.questions);
        setPhase('playing');
      })
      .catch(() => {
        setErrorMsg(t(getClientLocale(), 'failedLoad'));
        setPhase('error');
      });
  }, [level]);

  // Loading / Error
  if (phase === 'loading') {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.spinner} />
        <p>{t(locale, 'loadingLevel', { n: level })}</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className={styles.loadingPage}>
        <p>⚠️ {errorMsg}</p>
        <Link href="/dashboard" className={styles.btnSecondary}>{t(locale, 'backToDashboard')}</Link>
      </div>
    );
  }

  // Results / Answer Key
  if (phase === 'results' && results) {
    return <ResultsScreen results={results} level={level} locale={locale} onRetry={resetAndReload} />;
  }

  const question = questions[currentIndex];
  if (!question) return null;

  const progressPct = ((currentIndex) / questions.length) * 100;

  return (
    <div className={styles.page}>
      <div className={styles.hud}>
        <Link href="/dashboard" className={styles.exitBtn}>
          {t(locale, 'backToDashboard')}
        </Link>
        <div className={styles.hudScore}>
          {t(locale, 'score')}: <span>{score}</span>/{questions.length}
        </div>
        <div className={styles.hudProgress}>
          <div className={styles.progressBarOuter}>
            <div className={styles.progressBarInner} style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className={styles.hudQuestion}>
          Q {currentIndex + 1} / {questions.length}
        </div>
        <div className={`${styles.hudTimer} ${timeLeft <= 5 ? styles.danger : ''}`}>
          {timeLeft}s
        </div>
      </div>

      <div className={styles.gameBody}>
        <div className={styles.flagContainer}>
          <img
            className={styles.flagImg}
            src={question.flagPath}
            alt={t(locale, 'guessFlag')}
            draggable={false}
          />
        </div>

        <div className={styles.optionsGrid} key={question.countryId}>
          {question.options.map((option) => {
            let btnClass = styles.optionBtn;
            if (phase === 'feedback') {
              if (option === question.correctOption) {
                btnClass = `${styles.optionBtn} ${styles.correct}`;
              } else if (option === selectedAnswer) {
                btnClass = `${styles.optionBtn} ${styles.wrong}`;
              }
            }
            return (
              <button
                key={option}
                className={btnClass}
                onClick={() => handleAnswer(option)}
                disabled={phase === 'feedback'}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ResultsScreen({ results, level, locale, onRetry }: { results: SubmitGameResponse; level: number; locale: Locale; onRetry: () => void }) {
  const { passed, score, total, newCurrentLevel, answerKey } = results;

  return (
    <div className={styles.resultsPage}>
      <div className={`${styles.resultsBanner} ${passed ? styles.passed : styles.failed}`}>
        <div className={styles.resultsBannerIcon}>
          {passed ? '🏆' : '😤'}
        </div>
        {passed && (
          <div className={styles.levelUpText}>{t(locale, 'levelUp')}</div>
        )}
        <div className={`${styles.resultScore} ${passed ? styles.allCorrect : styles.failed}`}>
          {score} / {total}
        </div>
        <p className={styles.resultSubtext}>
          {passed
            ? t(locale, 'unlockedMsg', { n: newCurrentLevel })
            : t(locale, 'needPerfect')}
        </p>
        <div className={styles.resultActions}>
          {passed ? (
            <>
              <Link href={`/game/${level + 1}`} className={styles.btnPrimary}>
                {t(locale, 'playLevel', { n: level + 1 })}
              </Link>
              <Link href="/dashboard" className={styles.btnSecondary}>
                {t(locale, 'dashboard')}
              </Link>
            </>
          ) : (
            <>
              <button onClick={onRetry} className={styles.btnPrimary}>
                {t(locale, 'retryLevel', { n: level })}
              </button>
              <Link href="/dashboard" className={styles.btnSecondary}>
                {t(locale, 'dashboard')}
              </Link>
            </>
          )}
        </div>
      </div>

      <p className={styles.answerKeyTitle}>{t(locale, 'answerKey')}</p>
      <div className={styles.answerKeyList}>
        {answerKey.map((item: AnswerKeyItem, idx: number) => (
          <AnswerRow key={idx} item={item} locale={locale} />
        ))}
      </div>
    </div>
  );
}

function AnswerRow({ item, locale }: { item: AnswerKeyItem; locale: Locale }) {
  const rowClass = `${styles.answerKeyRow} ${item.isCorrect ? styles.correct : styles.wrong}`;
  return (
    <div className={rowClass}>
      <img
        className={styles.answerKeyFlag}
        src={item.flagPath}
        alt={item.correctOption}
      />
      <div className={styles.answerKeyInfo}>
        <div className={styles.answerKeyCorrect}>{item.correctOption}</div>
        {!item.isCorrect && (
          <div className={`${styles.answerKeyUser} ${styles.wrong}`}>
            {t(locale, 'yourAnswer', { a: item.userAnswer ?? t(locale, 'timedOut') })}
          </div>
        )}
        {item.isCorrect && (
          <div className={`${styles.answerKeyUser} ${styles.correct}`}>
            {t(locale, 'correctMsg')}
          </div>
        )}
      </div>
      <div className={styles.answerKeyIcon}>
        {item.isCorrect ? '✅' : '❌'}
      </div>
    </div>
  );
}
