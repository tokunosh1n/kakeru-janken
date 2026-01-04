import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Zap, Users, Crown } from 'lucide-react';

const HAND_NAMES = {
  rock: '✊ グー',
  paper: '✋ パー',
  scissors: '✌ チョキ'
};

const HAND_EMOJI = {
  rock: '✊',
  paper: '✋',
  scissors: '✌'
};

class Player {
  constructor(name, isHuman = false) {
    this.name = name;
    this.isHuman = isHuman;
    this.points = 50;
    this.carryOverPoints = 0; // 引き継ぎポイント（ランキング計算外）
    this.consecutiveLoseDeclarations = 0;
    this.consecutiveWinDeclarations = 0;
    this.declarationHistory = [];
    this.winHistory = [];
    this.totalWins = 0;
    this.losses = 0;
    this.bracket = "winner";
    this.finalBet = null;
  }
  
  getTotalPoints() {
    return this.points + this.carryOverPoints;
  }
  
  getRankingPoints() {
    return this.points; // ランキング計算用は引き継ぎポイントを含まない
  }

  makeDeclaration(opponent = null) {
    if (this.isHuman) return null;
    
    const strategy = ['random', 'trend', 'points'][Math.floor(Math.random() * 3)];
    if (strategy === 'random') {
      return Math.random() > 0.5 ? 'win' : 'lose';
    } else if (strategy === 'trend' && opponent && opponent.declarationHistory.length > 2) {
      const recent = opponent.declarationHistory.slice(-3);
      const winCount = recent.filter(d => d === 'win').length;
      if (winCount > recent.length - winCount) {
        return Math.random() > 0.4 ? 'lose' : 'win';
      } else {
        return Math.random() > 0.4 ? 'win' : 'lose';
      }
    } else {
      if (this.points < 200) {
        return Math.random() > 0.3 ? 'lose' : 'win';
      } else {
        return Math.random() > 0.5 ? 'win' : 'lose';
      }
    }
  }

  makeHand() {
    if (this.isHuman) return null;
    const hands = ['rock', 'paper', 'scissors'];
    return hands[Math.floor(Math.random() * 3)];
  }

  addPoints(declaration, wonMatch) {
    this.declarationHistory.push(declaration);
    this.winHistory.push(wonMatch);
    
    if (wonMatch) {
      this.totalWins++;
    } else {
      this.losses++;
    }
    
    const success = (declaration === 'win' && wonMatch) || (declaration === 'lose' && !wonMatch);
    let reward = 0;
    
    if (success) {
      if (declaration === 'win') {
        const bonus = this.consecutiveWinDeclarations * 50;
        reward = 100 + bonus;
        this.points += reward;
        this.consecutiveWinDeclarations++;
        this.consecutiveLoseDeclarations = 0;
      } else {
        const baseReward = 200;
        const penalty = this.consecutiveLoseDeclarations * 50;
        reward = Math.max(50, baseReward - penalty);
        this.points += reward;
        this.consecutiveLoseDeclarations++;
        this.consecutiveWinDeclarations = 0;
      }
    } else {
      this.consecutiveWinDeclarations = 0;
      this.consecutiveLoseDeclarations = 0;
      reward = 0;
    }
    
    return { success, reward };
  }
}

const KakeruJanken = () => {
  const [gameState, setGameState] = useState('menu');
  const [players, setPlayers] = useState([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [allMatches, setAllMatches] = useState([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [currentP1, setCurrentP1] = useState(null);
  const [currentP2, setCurrentP2] = useState(null);
  const [currentBracket, setCurrentBracket] = useState(null);
  const [playerDeclaration, setPlayerDeclaration] = useState(null);
  const [playerHand, setPlayerHand] = useState(null);
  const [opponentHand, setOpponentHand] = useState(null);
  const [opponentDeclaration, setOpponentDeclaration] = useState(null);
  const [matchResultText, setMatchResultText] = useState('');
  const [playerReward, setPlayerReward] = useState(0);
  const [finalWinnerName, setFinalWinnerName] = useState(null);
  const [finalOdds, setFinalOdds] = useState({});
  const [betAmount, setBetAmount] = useState(0);
  const [bets, setBets] = useState({});
  const [pointWinner, setPointWinner] = useState(null);
  const [allWinner, setAllWinner] = useState(null);
  const [spectators, setSpectators] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [isNameInput, setIsNameInput] = useState(false);
  const [finalBetResult, setFinalBetResult] = useState(null);
  const [savedPlayerData, setSavedPlayerData] = useState(null);
  
  // AudioContext for sound effects
  const audioContextRef = useRef(null);

  const humanPlayer = players.find(p => p.isHuman);

  // Initialize AudioContext
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }, []);

  // Sound effect functions
  const playSound = (type) => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    switch(type) {
      case 'click':
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.1);
        break;
      
      case 'win':
        oscillator.frequency.value = 523.25; // C5
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        oscillator.start(ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.1); // G5
        oscillator.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.2); // C6
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.stop(ctx.currentTime + 0.3);
        break;
      
      case 'lose':
        oscillator.frequency.value = 523.25;
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        oscillator.start(ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(392.00, ctx.currentTime + 0.1);
        oscillator.frequency.exponentialRampToValueAtTime(261.63, ctx.currentTime + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.stop(ctx.currentTime + 0.3);
        break;
      
      case 'final':
        // Fanfare sound
        const playNote = (freq, startTime, duration) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.15, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
          osc.start(startTime);
          osc.stop(startTime + duration);
        };
        
        playNote(523.25, ctx.currentTime, 0.2); // C
        playNote(659.25, ctx.currentTime + 0.15, 0.2); // E
        playNote(783.99, ctx.currentTime + 0.3, 0.2); // G
        playNote(1046.50, ctx.currentTime + 0.45, 0.4); // C
        break;
      
      case 'bet':
        oscillator.frequency.value = 1000;
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.05);
        break;
    }
  };

  const startNameInput = () => {
    playSound('click');
    setIsNameInput(true);
  };

  const initGame = (continueWithPoints = false) => {
    playSound('click');
    const finalName = playerName.trim() || savedPlayerData?.name || 'あなた';
    const carryOver = continueWithPoints && savedPlayerData ? savedPlayerData.points : 0;
    
    const newPlayers = [new Player(finalName, true)];
    newPlayers[0].points = 50; // トーナメントポイントは常に50から
    if (carryOver > 0) {
      newPlayers[0].carryOverPoints = carryOver; // 引き継ぎがある場合のみ設定
    }
    for (let i = 0; i < 15; i++) {
      newPlayers.push(new Player(`CPU-${i + 1}`));
    }
    
    // シャッフル
    for (let i = newPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newPlayers[i], newPlayers[j]] = [newPlayers[j], newPlayers[i]];
    }
    
    setPlayers(newPlayers);
    setIsNameInput(false);
    setSavedPlayerData(null);
    prepareRound(1, newPlayers);
  };

  const prepareRound = (roundNum, playersList) => {
    console.log(`=== ラウンド${roundNum}開始 ===`);
    
    // 4ラウンド終了後は最終戦へ
    if (roundNum > 4) {
      console.log('4ラウンド終了、最終戦へ');
      startFinalBattle(playersList);
      return;
    }
    
    const winnerPlayers = playersList.filter(p => p.bracket === "winner");
    const loserPlayers = playersList.filter(p => p.bracket === "loser");
    const dropoutPlayers = playersList.filter(p => p.bracket === "dropout");
    const underdogPlayers = playersList.filter(p => p.bracket === "underdog");
    
    console.log(`全勝戦: ${winnerPlayers.length}人, 負け組: ${loserPlayers.length}人, 落ちこぼれ: ${dropoutPlayers.length}人, 下剋上: ${underdogPlayers.length}人`);
    
    const newMatches = [];
    
    for (let i = 0; i < winnerPlayers.length; i += 2) {
      if (i + 1 < winnerPlayers.length) {
        newMatches.push([winnerPlayers[i], winnerPlayers[i + 1], "winner"]);
      }
    }
    for (let i = 0; i < loserPlayers.length; i += 2) {
      if (i + 1 < loserPlayers.length) {
        newMatches.push([loserPlayers[i], loserPlayers[i + 1], "loser"]);
      }
    }
    for (let i = 0; i < dropoutPlayers.length; i += 2) {
      if (i + 1 < dropoutPlayers.length) {
        newMatches.push([dropoutPlayers[i], dropoutPlayers[i + 1], "dropout"]);
      }
    }
    for (let i = 0; i < underdogPlayers.length; i += 2) {
      if (i + 1 < underdogPlayers.length) {
        newMatches.push([underdogPlayers[i], underdogPlayers[i + 1], "underdog"]);
      }
    }
    
    console.log(`試合数: ${newMatches.length}`);
    
    if (newMatches.length === 0) {
      // 試合がない場合は次のラウンドまたは最終戦へ
      prepareRound(roundNum + 1, playersList);
      return;
    }
    
    setCurrentRound(roundNum);
    setAllMatches(newMatches);
    setCurrentMatchIdx(0);
    
    // CPU同士の試合を先に全部処理
    let processedCount = 0;
    for (let i = 0; i < newMatches.length; i++) {
      const [p1, p2, bracket] = newMatches[i];
      if (!p1.isHuman && !p2.isHuman) {
        simulateCPUMatch(p1, p2, bracket);
        processedCount++;
      } else {
        break; // プレイヤーの試合が来たら停止
      }
    }
    
    console.log(`CPU試合処理数: ${processedCount}`);
    
    // プレイヤーの試合があるか確認
    const playerMatchIdx = newMatches.findIndex(([p1, p2]) => p1.isHuman || p2.isHuman);
    
    if (playerMatchIdx === -1) {
      // プレイヤーの試合がない場合は次のラウンドへ
      console.log('プレイヤーの試合なし、次ラウンドへ');
      prepareRound(roundNum + 1, playersList);
    } else {
      // プレイヤーの試合を開始
      setCurrentMatchIdx(playerMatchIdx);
      const [p1, p2, bracket] = newMatches[playerMatchIdx];
      startPlayerMatch(p1, p2, bracket);
    }
  };

  const startPlayerMatch = (p1, p2, bracket) => {
    console.log(`プレイヤー試合開始: ${p1.name} vs ${p2.name} (${bracket})`);
    setCurrentP1(p1);
    setCurrentP2(p2);
    setCurrentBracket(bracket);
    setMatchResultText('');
    setPlayerDeclaration(null);
    setPlayerHand(null);
    setOpponentDeclaration(null);
    setGameState('declaration');
  };

  const simulateCPUMatch = (p1, p2, bracket) => {
    const d1 = p1.makeDeclaration(p2);
    const d2 = p2.makeDeclaration(p1);
    
    let h1, h2;
    do {
      h1 = p1.makeHand();
      h2 = p2.makeHand();
    } while (h1 === h2);
    
    const winConditions = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
    const p1Won = winConditions[h1] === h2;
    
    p1.addPoints(d1, p1Won);
    p2.addPoints(d2, !p1Won);
    
    const loser = p1Won ? p2 : p1;
    
    if (bracket === "winner") {
      loser.bracket = "loser";
    } else if (bracket === "loser") {
      loser.bracket = "dropout";
    } else if (bracket === "dropout") {
      loser.bracket = "underdog";
    }
  };

  const makeDeclaration = (declaration) => {
    playSound('click');
    setPlayerDeclaration(declaration);
    setGameState('hand');
    setMatchResultText(`宣言: ${declaration === 'win' ? '勝ち' : '負け'}`);
  };

  const makeHand = (hand) => {
    playSound('click');
    const opponent = currentP1?.isHuman ? currentP2 : currentP1;
    const oppDecl = opponent.makeDeclaration(humanPlayer);
    const oppHand = opponent.makeHand();
    
    setPlayerHand(hand);
    setOpponentHand(oppHand);
    setOpponentDeclaration(oppDecl);
    
    if (hand === oppHand) {
      setMatchResultText(`あいこ\n(相手の宣言: ${oppDecl === 'win' ? '勝ち' : '負け'})`);
      return;
    }
    
    setGameState('resolving');
    setTimeout(() => resolveJanken(hand, oppHand, oppDecl), 1000);
  };

  const resolveJanken = (pHand, oHand, oDecl) => {
    const winConditions = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
    const playerWon = winConditions[pHand] === oHand;
    
    const opponent = currentP1?.isHuman ? currentP2 : currentP1;
    const { success, reward } = humanPlayer.addPoints(playerDeclaration, playerWon);
    
    // Play success/fail sound based on declaration result
    playSound(success ? 'win' : 'lose');
    
    opponent.addPoints(oDecl, !playerWon);
    
    const loser = playerWon ? opponent : humanPlayer;
    
    if (currentBracket === "winner") {
      loser.bracket = "loser";
    } else if (currentBracket === "loser") {
      loser.bracket = "dropout";
    } else if (currentBracket === "dropout") {
      loser.bracket = "underdog";
    }
    
    setPlayerReward(reward);
    setMatchResultText(
      `--- 試合結果 ---\nじゃんけん: ${playerWon ? '勝利' : '敗北'} | 宣言: ${success ? '成功' : '失敗'} (${playerDeclaration})\n獲得ポイント: +${reward}pt`
    );
    setGameState('display_result');
    setPlayers([...players]);
  };

  const nextMatch = () => {
    playSound('click');
    console.log(`次の試合へ (現在: ${currentMatchIdx}/${allMatches.length})`);
    
    // 次のプレイヤー試合を探す
    let nextPlayerMatchIdx = -1;
    for (let i = currentMatchIdx + 1; i < allMatches.length; i++) {
      const [p1, p2] = allMatches[i];
      if (p1.isHuman || p2.isHuman) {
        nextPlayerMatchIdx = i;
        break;
      } else {
        // CPU試合を処理
        const [, , bracket] = allMatches[i];
        simulateCPUMatch(p1, p2, bracket);
      }
    }
    
    if (nextPlayerMatchIdx !== -1) {
      // 次のプレイヤー試合がある
      setCurrentMatchIdx(nextPlayerMatchIdx);
      const [p1, p2, bracket] = allMatches[nextPlayerMatchIdx];
      startPlayerMatch(p1, p2, bracket);
    } else {
      // このラウンドの全試合終了、次のラウンドへ
      console.log(`ラウンド${currentRound}終了、次ラウンドへ`);
      prepareRound(currentRound + 1, players);
    }
  };

  const startFinalBattle = (playersList) => {
    console.log('=== 最終戦開始 ===');
    playSound('final');
    const sortedByPoints = [...playersList].sort((a, b) => b.getRankingPoints() - a.getRankingPoints());
    const pWinner = sortedByPoints[0];
    const undefeated = playersList.filter(p => p.losses === 0 && p.bracket === "winner");
    const aWinner = undefeated.length > 0 ? undefeated[0] : pWinner;
    
    setPointWinner(pWinner);
    setAllWinner(aWinner);
    
    if (pWinner === aWinner) {
      // 全勝者とポイント王者が同一人物の場合、ポイントを2倍にする
      console.log(`${pWinner.name}が全勝者かつポイント王者！ポイント2倍！`);
      const doublePoints = pWinner.points * 2;
      pWinner.points = doublePoints;
      
      // 初回プレイの場合はトーナメントポイントに、引き継ぎありの場合は引き継ぎポイントに
      if (pWinner.isHuman && pWinner.carryOverPoints > 0) {
        // 引き継ぎがある場合は、増加分を引き継ぎポイントに
        const increase = pWinner.points;
        pWinner.carryOverPoints += increase;
      }
      
      setPlayers([...playersList]);
      setGameState('game_over');
      return;
    }
    
    const specs = playersList.filter(p => p !== pWinner && p !== aWinner);
    setSpectators(specs);
    
    const newBets = { [pWinner.name]: 0, [aWinner.name]: 0 };
    
    specs.forEach(spec => {
      if (!spec.isHuman && spec.points > 0) {
        const betAmt = Math.floor(Math.random() * Math.min(spec.points, 1000));
        const betTarget = Math.random() > 0.5 ? pWinner : aWinner;
        spec.points -= betAmt;
        newBets[betTarget.name] += betAmt;
        spec.finalBet = { target: betTarget.name, amount: betAmt };
      }
    });
    
    // プレイヤーが観戦者の場合、全BETボタンのために全ポイントを使用可能にする
    if (humanPlayer && (humanPlayer === pWinner || humanPlayer === aWinner)) {
      // プレイヤーが対戦者の場合は通常通り
    } else if (humanPlayer) {
      // プレイヤーが観戦者の場合、賭けられる最大額を事前に計算
      // （実際の減算はconfirmBetSpectatorで行う）
    }
    
    setBets(newBets);
    
    const totalPw = newBets[pWinner.name];
    const totalAw = newBets[aWinner.name];
    const oddsPw = totalAw > 0 && totalPw > 0 ? totalAw / totalPw : 1.0;
    const oddsAw = totalPw > 0 && totalAw > 0 ? totalPw / totalAw : 1.0;
    
    setFinalOdds({
      [pWinner.name]: Math.max(1.0, oddsPw),
      [aWinner.name]: Math.max(1.0, oddsAw)
    });
    
    if (pWinner.isHuman || aWinner.isHuman) {
      setGameState('final_betting_player');
      setBetAmount(0);
    } else {
      setGameState('final_betting_spectator');
      setBetAmount(0);
    }
  };

  const updateBet = (change) => {
    const maxBet = humanPlayer ? humanPlayer.getTotalPoints() : 0;
    const newBet = Math.max(0, Math.min(betAmount + change, maxBet));
    if (newBet !== betAmount) {
      playSound('bet');
    }
    setBetAmount(newBet);
  };

  const confirmBetPlayer = () => {
    if (betAmount === 0) {
      playSound('lose');
      setMatchResultText('賭けポイントは1pt以上にしてください');
      return;
    }
    
    playSound('click');
    
    // ポイントの減算（引き継ぎポイントから優先的に使用）
    let remainingBet = betAmount;
    if (humanPlayer.carryOverPoints >= remainingBet) {
      humanPlayer.carryOverPoints -= remainingBet;
    } else {
      remainingBet -= humanPlayer.carryOverPoints;
      humanPlayer.carryOverPoints = 0;
      humanPlayer.points -= remainingBet;
    }
    
    const newBets = { ...bets };
    newBets[humanPlayer.name] = (newBets[humanPlayer.name] || 0) + betAmount;
    setBets(newBets);
    
    setGameState('final_janken_input');
    setMatchResultText('最終戦: じゃんけんの手を選択してください');
  };

  const confirmBetSpectator = (targetName) => {
    if (betAmount === 0) {
      playSound('lose');
      setMatchResultText('賭けポイントは1pt以上にしてください');
      return;
    }
    
    playSound('click');
    
    // ポイントの減算（引き継ぎポイントから優先的に使用）
    let remainingBet = betAmount;
    if (humanPlayer.carryOverPoints >= remainingBet) {
      humanPlayer.carryOverPoints -= remainingBet;
    } else {
      remainingBet -= humanPlayer.carryOverPoints;
      humanPlayer.carryOverPoints = 0;
      humanPlayer.points -= remainingBet;
    }
    
    humanPlayer.finalBet = { target: targetName, amount: betAmount };
    const newBets = { ...bets };
    newBets[targetName] = (newBets[targetName] || 0) + betAmount;
    setBets(newBets);
    
    setGameState('final_janken_cpu');
    setTimeout(() => resolveFinalJanken(null, targetName), 1000);
  };

  const setFinalHand = (hand) => {
    playSound('click');
    setPlayerHand(hand);
    const opponent = humanPlayer === pointWinner ? allWinner : pointWinner;
    const oppHand = opponent.makeHand();
    setOpponentHand(oppHand);
    
    setGameState('final_janken_resolving');
    setTimeout(() => resolveFinalJanken(hand, null), 1000);
  };

  const resolveFinalJanken = (pHand, betTarget) => {
    let p1, p2, h1, h2;
    
    if (pHand) {
      p1 = humanPlayer;
      p2 = humanPlayer === pointWinner ? allWinner : pointWinner;
      h1 = pHand;
      h2 = opponentHand;
    } else {
      p1 = pointWinner;
      p2 = allWinner;
      do {
        h1 = p1.makeHand();
        h2 = p2.makeHand();
      } while (h1 === h2);
    }
    
    const winConditions = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
    const p1Won = winConditions[h1] === h2;
    const winner = p1Won ? p1 : p2;
    
    setFinalWinnerName(winner.name);
    
    const totalP1 = bets[p1.name] || 0;
    const totalP2 = bets[p2.name] || 0;
    const oddsP1 = totalP1 > 0 ? totalP2 / totalP1 : 1.0;
    const oddsP2 = totalP2 > 0 ? totalP1 / totalP2 : 1.0;
    
    let playerBetSuccess = false;
    let playerBetReward = 0;
    
    if (humanPlayer.finalBet) {
      const { target, amount } = humanPlayer.finalBet;
      if (target === winner.name) {
        const odds = target === p1.name ? oddsP1 : oddsP2;
        playerBetReward = Math.floor(amount * (1 + odds));
        
        // 初回プレイ（引き継ぎなし）の場合はトーナメントポイントに加算
        if (humanPlayer.carryOverPoints === 0) {
          humanPlayer.points += playerBetReward;
        } else {
          // 引き継ぎありの場合は引き継ぎポイントに加算
          humanPlayer.carryOverPoints += playerBetReward;
        }
        playerBetSuccess = true;
      }
    } else if (pHand && winner === humanPlayer) {
      const odds = winner === p1 ? oddsP1 : oddsP2;
      playerBetReward = Math.floor(betAmount * (1 + odds));
      
      // 初回プレイ（引き継ぎなし）の場合はトーナメントポイントに加算
      if (humanPlayer.carryOverPoints === 0) {
        humanPlayer.points += playerBetReward;
      } else {
        // 引き継ぎありの場合は引き継ぎポイントに加算
        humanPlayer.carryOverPoints += playerBetReward;
      }
      playerBetSuccess = true;
    }
    
    // Set bet result for display
    setFinalBetResult({
      success: playerBetSuccess,
      reward: playerBetReward,
      betAmount: humanPlayer.finalBet ? humanPlayer.finalBet.amount : betAmount,
      target: humanPlayer.finalBet ? humanPlayer.finalBet.target : (pHand ? humanPlayer.name : null)
    });
    
    // Play sound based on bet result
    playSound(playerBetSuccess ? 'win' : 'lose');
    
    spectators.forEach(spec => {
      if (!spec.isHuman && spec.finalBet) {
        const { target, amount } = spec.finalBet;
        if (target === winner.name) {
          const odds = target === p1.name ? oddsP1 : oddsP2;
          spec.points += Math.floor(amount * (1 + odds));
        }
      }
    });
    
    setPlayers([...players]);
    setGameState('final_result');
  };

  const bracketNames = {
    winner: "全勝戦",
    loser: "負け組戦",
    dropout: "落ちこぼれ戦",
    underdog: "下剋上戦"
  };

  const bracketNamesShort = {
    winner: "勝ち組",
    loser: "負け組",
    dropout: "落ちこぼれ",
    underdog: "下剋上"
  };

  const getPlayerTitle = (player) => {
    if (player === pointWinner) return "ポイント王者";
    if (player === allWinner) return "全勝者";
    return bracketNamesShort[player.bracket] || "";
  };

  const continuePlay = () => {
    playSound('click');
    // プレイヤーデータを保存（合計ポイント）
    if (humanPlayer) {
      setSavedPlayerData({
        name: humanPlayer.name,
        points: humanPlayer.getTotalPoints()
      });
    }
    // メニューに戻る
    setGameState('menu');
    setPlayers([]);
    setCurrentRound(1);
    setAllMatches([]);
    setCurrentMatchIdx(0);
    setCurrentP1(null);
    setCurrentP2(null);
    setCurrentBracket(null);
    setPlayerDeclaration(null);
    setPlayerHand(null);
    setOpponentHand(null);
    setOpponentDeclaration(null);
    setMatchResultText('');
    setPlayerReward(0);
    setFinalWinnerName(null);
    setFinalOdds({});
    setBetAmount(0);
    setBets({});
    setPointWinner(null);
    setAllWinner(null);
    setSpectators([]);
    setFinalBetResult(null);
  };

  const sortedPlayers = [...players].sort((a, b) => b.getRankingPoints() - a.getRankingPoints());
  const playerRank = humanPlayer ? sortedPlayers.indexOf(humanPlayer) + 1 : 0;
  const opponent = currentP1?.isHuman ? currentP2 : currentP1;

  const loseReward = humanPlayer ? Math.max(50, 200 - humanPlayer.consecutiveLoseDeclarations * 50) : 50;
  const winReward = humanPlayer ? 100 + humanPlayer.consecutiveWinDeclarations * 50 : 100;

  return (
    <div className="min-h-screen relative overflow-hidden text-white p-4">
      {/* アニメーション背景 */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black"></div>
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-96 h-96 bg-red-900 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-800 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-red-950 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-red-950/10 to-black"></div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>

      {/* メニュー画面 */}
      {gameState === 'menu' && !isNameInput && (
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 mt-12">
            <h1 className="text-6xl font-bold mb-4 text-yellow-400 flex items-center justify-center gap-3">
              <Zap className="w-12 h-12" />
              賭けジャンケン
              <Zap className="w-12 h-12" />
            </h1>
          </div>
          
          <div className="bg-slate-800 bg-opacity-80 rounded-lg p-8 mb-8 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-yellow-300">【ゲーム概要】</h2>
            <ul className="space-y-2 text-lg mb-6">
              <li>• 16人のじゃんけんトーナメント</li>
              <li>• 勝敗宣言成功でポイントGET</li>
              <li className="ml-4">勝ち宣言: 連続成功でポイントアップ 基本+100pt, 連続+50pt</li>
              <li className="ml-4">負け宣言: 連続成功でポイントダウン 基本+200pt, 連続-50pt</li>
            </ul>
            
            <h2 className="text-2xl font-bold mb-4 text-yellow-300">【トーナメント-4ラウンド】</h2>
            <ul className="space-y-2 text-lg mb-6">
              <li>• 負ける度に階級が下がる</li>
              <li>• 全勝戦 → 負け組戦 → 落ちこぼれ戦 → 下剋上戦</li>
              <li>• 全勝戦の勝者(全勝者)は 最終戦 に進む</li>
            </ul>
            
            <h2 className="text-2xl font-bold mb-4 text-yellow-300">【最終戦-賭けジャンケン】</h2>
            <ul className="space-y-2 text-lg mb-6">
              <li>• 全勝者とポイント王者による最終戦</li>
              <li>• 観戦者は勝利者を予想しポイントを賭ける</li>
              <li>• 賭けられたポイントによってオッズが決まり、ポイント倍増のチャンスとなる</li>
            </ul>
            
            <p className="text-center text-gray-300 mt-6">参加する者には、50ptが支給されている</p>
          </div>
          
          <button
            onClick={startNameInput}
            className="w-full max-w-md mx-auto block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-lg text-2xl transition-all transform hover:scale-105 shadow-lg"
          >
            {savedPlayerData ? '次のゲームへ' : '賭けジャンケン開始'}
          </button>
        </div>
      )}

      {/* 名前入力画面 */}
      {gameState === 'menu' && isNameInput && (
        <div className="max-w-2xl mx-auto mt-32">
          <div className="bg-slate-800 bg-opacity-90 rounded-lg p-12 shadow-2xl">
            {savedPlayerData ? (
              <>
                <h2 className="text-4xl font-bold mb-8 text-center text-yellow-400">ゲームモード選択</h2>
                <div className="text-center mb-8 space-y-2">
                  <div className="text-2xl">プレイヤー: {savedPlayerData.name}</div>
                  <div className="text-xl text-gray-300">前回のポイント: {savedPlayerData.points}pt</div>
                </div>
                <div className="space-y-4">
                  <button
                    onClick={() => initGame(true)}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all transform hover:scale-105 shadow-lg"
                  >
                    ポイント引継ぎ ({savedPlayerData.points}pt →)
                  </button>
                  <button
                    onClick={() => initGame(false)}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all transform hover:scale-105 shadow-lg"
                  >
                    ポイントリセット (50pt →)
                  </button>
                  <button
                    onClick={() => setIsNameInput(false)}
                    className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all"
                  >
                    戻る
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-4xl font-bold mb-8 text-center text-yellow-400">プレイヤー名を入力</h2>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && initGame(false)}
                  placeholder="名前を入力（空欄の場合は「あなた」）"
                  maxLength={15}
                  className="w-full bg-slate-700 text-white text-2xl px-6 py-4 rounded-lg mb-8 text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
                <div className="flex gap-4">
                  <button
                    onClick={() => setIsNameInput(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all"
                  >
                    戻る
                  </button>
                  <button
                    onClick={() => initGame(false)}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all transform hover:scale-105 shadow-lg"
                  >
                    開始
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ゲーム中画面 */}
      {gameState !== 'menu' && gameState !== 'game_over' && (
        <div className="max-w-6xl mx-auto">
          {/* ステータスバー */}
          <div className="bg-slate-800 bg-opacity-90 rounded-lg p-4 mb-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <span className="text-xl">現在の順位: {playerRank}位/{players.length}人</span>
            </div>
            <div className="text-xl font-bold">
              あなたのポイント: <span className="text-yellow-400">
                {humanPlayer && humanPlayer.carryOverPoints > 0 
                  ? `${humanPlayer.points}pt (合計${humanPlayer.getTotalPoints()}pt)`
                  : `${humanPlayer?.points || 0}pt`
                }
              </span>
            </div>
          </div>

          {/* 試合情報 */}
          {!gameState.startsWith('final_') && currentP1 && currentP2 && (
            <div className="text-center mb-8">
              <div className="text-2xl font-bold text-purple-300 mb-2">
                {bracketNames[currentBracket]} - ラウンド{currentRound}
              </div>
              <div className="text-4xl font-bold mb-4">
                {currentP1.name} vs {currentP2.name}
              </div>
              {opponent && (
                <div className="text-lg text-gray-300">
                  相手 ({opponent.name}) の情報: {opponent.points}pt - {sortedPlayers.indexOf(opponent) + 1}位
                </div>
              )}
            </div>
          )}

          {/* 結果表示 */}
          {matchResultText && (
            <div className="bg-slate-800 bg-opacity-90 rounded-lg p-6 mb-6 text-center">
              <div className="text-2xl whitespace-pre-line">{matchResultText}</div>
            </div>
          )}

          {/* 宣言ボタン */}
          {gameState === 'declaration' && (
            <div className="flex gap-4 justify-center mb-8">
              <button
                onClick={() => makeDeclaration('win')}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-6 px-8 rounded-lg text-2xl transition-all transform hover:scale-105 shadow-lg"
              >
                勝ち宣言 (+{winReward})
              </button>
              <button
                onClick={() => makeDeclaration('lose')}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-6 px-8 rounded-lg text-2xl transition-all transform hover:scale-105 shadow-lg"
              >
                負け宣言 (+{loseReward})
              </button>
            </div>
          )}

          {/* じゃんけんボタン */}
          {gameState === 'hand' && (
            <div>
              <div className="text-2xl text-center mb-4">じゃんけんの手を選択</div>
              <div className="flex gap-4 justify-center mb-8">
                {['rock', 'paper', 'scissors'].map(hand => (
                  <button
                    key={hand}
                    onClick={() => makeHand(hand)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-8 rounded-lg text-3xl transition-all transform hover:scale-105 shadow-lg"
                  >
                    {HAND_NAMES[hand]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* じゃんけん演出 */}
          {gameState === 'resolving' && (
            <div className="text-center text-3xl space-y-4 mb-8">
              <div className="flex justify-center items-center gap-8">
                <div className="text-green-400">{humanPlayer?.name}: {HAND_EMOJI[playerHand]}</div>
                <div>VS</div>
                <div className="text-red-400">{opponent?.name}: {HAND_EMOJI[opponentHand]}</div>
              </div>
              <div className="text-xl">判定中...</div>
            </div>
          )}

          {/* 次へボタン */}
          {gameState === 'display_result' && (
            <div className="flex justify-center">
              <button
                onClick={nextMatch}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-12 rounded-lg text-2xl transition-all transform hover:scale-105 shadow-lg"
              >
                次へ
              </button>
            </div>
          )}

          {/* 最終戦ベッティング */}
          {(gameState === 'final_betting_player' || gameState === 'final_betting_spectator') && pointWinner && allWinner && (
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-4xl font-bold mb-4 text-yellow-400">--- 最終戦: 賭けジャンケン ---</h2>
                <div className="text-3xl mb-6">
                  {pointWinner.name} (ポイント王) vs {allWinner.name} (全勝者)
                </div>
                <div className="flex justify-center gap-12 mb-8 text-2xl">
                  <div className="text-green-400">{pointWinner.name}: {finalOdds[pointWinner.name]?.toFixed(1)}倍</div>
                  <div className="text-red-400">{allWinner.name}: {finalOdds[allWinner.name]?.toFixed(1)}倍</div>
                </div>
              </div>

              <div className="bg-slate-800 bg-opacity-90 rounded-lg p-8 mb-6">
                <div className="text-center mb-6">
                  <div className="text-xl mb-4">
                    所持ポイント: {humanPlayer && humanPlayer.carryOverPoints > 0 
                      ? `${humanPlayer.points}pt (合計${humanPlayer.getTotalPoints()}pt)`
                      : `${humanPlayer?.points || 0}pt`
                    }
                  </div>
                  <div className="text-4xl font-bold mb-6">
                    <input
                      type="text"
                      value={betAmount}
                      readOnly
                      className="bg-gray-700 text-white text-center w-32 px-4 py-2 rounded-lg"
                    />
                    <span className="ml-2">pt</span>
                  </div>
                  
                  <div className="flex gap-2 justify-center mb-4">
                    <button onClick={() => updateBet(100)} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">+100</button>
                    <button onClick={() => updateBet(50)} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">+50</button>
                    <button onClick={() => updateBet(-50)} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">-50</button>
                    <button onClick={() => updateBet(-100)} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">-100</button>
                  </div>
                  
                  <button 
                    onClick={() => updateBet(humanPlayer?.getTotalPoints() || 0)} 
                    className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg mb-6"
                  >
                    全BET
                  </button>
                </div>

                {gameState === 'final_betting_spectator' ? (
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => confirmBetSpectator(pointWinner.name)}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-6 px-8 rounded-lg text-xl"
                    >
                      {pointWinner.name}に賭ける
                    </button>
                    <button
                      onClick={() => confirmBetSpectator(allWinner.name)}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-6 px-8 rounded-lg text-xl"
                    >
                      {allWinner.name}に賭ける
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <button
                      onClick={confirmBetPlayer}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 px-12 rounded-lg text-xl"
                    >
                      賭けを確定する
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 最終戦じゃんけん入力 */}
          {gameState === 'final_janken_input' && (
            <div>
              <div className="text-2xl text-center mb-4">最終戦: じゃんけんの手を選択してください</div>
              <div className="flex gap-4 justify-center mb-8">
                {['rock', 'paper', 'scissors'].map(hand => (
                  <button
                    key={hand}
                    onClick={() => setFinalHand(hand)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-8 rounded-lg text-3xl transition-all transform hover:scale-105 shadow-lg"
                  >
                    {HAND_NAMES[hand]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 最終戦じゃんけん演出 */}
          {(gameState === 'final_janken_resolving' || gameState === 'final_janken_cpu') && (
            <div className="text-center text-3xl space-y-4 mb-8">
              <div className="text-xl">最終戦 判定中...</div>
            </div>
          )}
        </div>
      )}

      {/* 最終戦結果画面 */}
      {gameState === 'final_result' && finalBetResult && (
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold mb-6 text-yellow-400">--- 最終戦終了 ---</h1>
            <div className="text-4xl mb-6">
              優勝者: <span className={finalWinnerName === humanPlayer?.name ? 'text-green-400' : 'text-red-400'}>{finalWinnerName}!</span>
            </div>
          </div>

          <div className="bg-slate-800 bg-opacity-90 rounded-lg p-8 mb-8">
            <h2 className="text-3xl font-bold mb-6 text-center">あなたの賭け結果</h2>
            
            {finalBetResult.success ? (
              <div className="text-center space-y-4">
                <div className="text-5xl mb-4">🎉</div>
                <div className="text-3xl text-green-400 font-bold">賭け成功！</div>
                <div className="text-2xl">
                  賭け金: {finalBetResult.betAmount}pt
                </div>
                <div className="text-3xl text-yellow-400 font-bold">
                  獲得: +{finalBetResult.reward}pt
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="text-5xl mb-4">💔</div>
                <div className="text-3xl text-red-400 font-bold">賭け失敗...</div>
                <div className="text-2xl">
                  賭け金: {finalBetResult.betAmount}pt
                </div>
                <div className="text-2xl text-gray-400">
                  獲得: 0pt
                </div>
              </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-gray-600 text-center">
              <div className="text-2xl">
                最終ポイント: <span className="text-yellow-400 font-bold">
                  {humanPlayer && humanPlayer.carryOverPoints > 0 
                    ? `${humanPlayer.points}pt (合計${humanPlayer.getTotalPoints()}pt)`
                    : `${humanPlayer?.points || 0}pt`
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => {
                playSound('click');
                setGameState('game_over');
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-12 rounded-lg text-2xl transition-all transform hover:scale-105 shadow-lg"
            >
              最終ランキングを見る
            </button>
          </div>
        </div>
      )}

      {/* ゲームオーバー画面 */}
      {gameState === 'game_over' && (
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold mb-8 text-yellow-400 flex items-center justify-center gap-3">
              <Crown className="w-12 h-12" />
              トーナメント結果
              <Crown className="w-12 h-12" />
            </h1>
            
            {/* 全勝者=ポイント王者の場合の特別表示 */}
            {pointWinner === allWinner && (
              <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg p-6 mb-6 animate-pulse">
                <div className="text-4xl font-bold mb-2">🏆 完全制覇 🏆</div>
                <div className="text-2xl">
                  {pointWinner?.name}が全勝者かつポイント王者を獲得！
                </div>
                <div className="text-xl mt-2 text-yellow-200">
                  ボーナス: ポイント2倍！
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800 bg-opacity-90 rounded-lg p-6">
            <h2 className="text-3xl font-bold mb-6 text-center flex items-center justify-center gap-2">
              <Crown className="w-8 h-8 text-yellow-400" />
              最終ランキング
            </h2>
            <div className="space-y-2">
              {sortedPlayers.map((p, i) => {
                const title = getPlayerTitle(p);
                const isSpecialTitle = title === "ポイント王者" || title === "全勝者";
                
                return (
                  <div
                    key={i}
                    className={`flex justify-between items-center p-4 rounded-lg bg-slate-700 ${
                      p.isHuman ? 'ring-2 ring-blue-400' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold w-12">{i + 1}位</span>
                      <div>
                        <div className="text-xl">
                          {p.name} {p.isHuman && '★'}
                        </div>
                        {title && (
                          <div className={`text-sm ${
                            isSpecialTitle ? 'text-yellow-300 font-bold' : 'text-gray-400'
                          }`}>
                            {title}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-2xl font-bold">
                      {p.carryOverPoints > 0 
                        ? `${p.points}pt (合計${p.getTotalPoints()}pt)`
                        : `${p.points}pt`
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center mt-8">
            <button
              onClick={continuePlay}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-12 rounded-lg text-2xl transition-all transform hover:scale-105 shadow-lg"
            >
              続けて遊ぶ
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KakeruJanken;