export type GameId = 'pong-plus' | 'breakout' | 'space-invaders' | 'tetris';

export type GameDifficulty = 'easy' | 'medium' | 'hard' | 'overdrive';

export interface GameMetadata {
  id: GameId;
  title: string;
  subtitle: string;
  genre: string;
  tagline: string;
  iconName: string;
  badge: string;
  playerCount: '1-2 Players' | '1 Player';
  difficulty: string;
}

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'secret';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  gameId: GameId | 'global';
  icon: string;
  category: 'combat' | 'skill' | 'secret' | 'team';
  tier: AchievementTier;
  xp: number;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  maxProgress: number;
  criteriaDescription?: string;
}

export interface HighScoreEntry {
  id: string;
  gameId: GameId;
  playerName: string;
  avatar: string;
  score: number;
  levelReached: number;
  date: string;
  isCurrentUser?: boolean;
  team: 'Engineering' | 'Product' | 'Design' | 'Arcade Ops' | 'Security';
  device: 'Gamepad' | 'Keyboard' | 'Touch';
  verified: boolean;
  maxCombo?: number;
  stats?: {
    playtimeSeconds?: number;
    accuracy?: number;
    rallyPeak?: number;
  };
  hashSignature?: string;
}

export interface ScoreSubmissionData {
  gameId: GameId;
  gameTitle: string;
  score: number;
  levelReached: number;
  stats?: {
    playtimeSeconds?: number;
    accuracy?: number;
    rallyPeak?: number;
    maxCombo?: number;
  };
  deviceDefault: 'Gamepad' | 'Keyboard' | 'Touch';
}

export interface CloudSyncProfile {
  syncPasscode: string;
  deviceId: string;
  deviceName: string;
  playerHandle: string;
  playerAvatar: string;
  playerTitle: string;
  department: 'Engineering' | 'Product' | 'Design' | 'Arcade Ops' | 'Security';
  lastCloudTimestamp: number;
  cloudStorageStatus: 'connected' | 'syncing' | 'offline' | 'conflict';
  syncCount: number;
  remoteDeviceCount: number;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncedAt: string;
  pendingSyncCount: number;
  syncState: 'idle' | 'syncing' | 'synced' | 'offline';
  encryptionKeyFingerprint: string;
  cloudProfile?: CloudSyncProfile;
}

export interface GamepadState {
  connected: boolean;
  id: string;
  index: number;
  axes: [number, number, number, number]; // lx, ly, rx, ry
  buttons: {
    a: boolean;
    b: boolean;
    x: boolean;
    y: boolean;
    lb: boolean;
    rb: boolean;
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    start: boolean;
    select: boolean;
  };
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: 'Engineering' | 'Product' | 'Design' | 'Arcade Ops' | 'Security';
  avatar: string;
  status: 'online' | 'in-game' | 'busy' | 'offline';
  currentGame?: string;
  allocatedHours: number;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  category: 'Engine' | 'Multiplayer' | 'Security' | 'Cross-Platform' | 'Tournament';
  targetDate: string;
  progress: number; // 0-100
  status: 'in-progress' | 'completed' | 'pending' | 'review';
  assignee: string;
  resourceAllocationPct: number;
  notes: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  avatar: string;
  content: string;
  timestamp: string;
  isEncrypted: boolean;
  challenge?: {
    gameId: GameId;
    gameTitle: string;
    challengerScore?: number;
    wagerPoints: number;
    targetScore: number;
    accepted: boolean;
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'achievement' | 'challenge' | 'milestone' | 'sync' | 'system';
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  gameId: GameId | 'global';
  gameTitle: string;
  icon: string;
  progress: number;
  target: number;
  unit: string;
  xpReward: number;
  vaultTokenReward: number;
  completed: boolean;
  claimed: boolean;
  category: 'score' | 'combat' | 'skill' | 'social';
}

export interface CommunityActivityItem {
  id: string;
  type: 'achievement' | 'high_score' | 'challenge' | 'quest';
  playerName: string;
  avatar: string;
  team: 'Engineering' | 'Product' | 'Design' | 'Arcade Ops' | 'Security';
  gameId: GameId | 'global';
  gameTitle: string;
  title: string;
  details: string;
  timestamp: string;
  hypeCount: number;
  hasHyped?: boolean;
  score?: number;
  challengeData?: {
    wagerPoints: number;
    targetScore: number;
  };
}
