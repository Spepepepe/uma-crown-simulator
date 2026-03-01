import { Injectable, signal, computed } from '@angular/core';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { environment } from '@env';

/** AWS Cognitoを使った認証処理を提供するサービス */
@Injectable({ providedIn: 'root' })
export class AuthService {
  /** 現在のIDトークンを保持するシグナル */
  private tokenSignal = signal<string | null>(null);
  /** 起動時のセッション復元が完了したかどうかを示すシグナル */
  private initializedSignal = signal(false);
  /** CognitoユーザープールのSDKインスタンス */
  private userPool: CognitoUserPool;

  /** 現在のIDトークン（読み取り専用） */
  readonly token = this.tokenSignal.asReadonly();
  /** ログイン状態（トークンが存在する場合 true） */
  readonly isLoggedIn = computed(() => !!this.tokenSignal());
  /** 起動時のセッション復元が完了したかどうか（読み取り専用） */
  readonly isInitialized = this.initializedSignal.asReadonly();

  constructor() {
    this.userPool = new CognitoUserPool({
      UserPoolId: environment.cognito.userPoolId,
      ClientId: environment.cognito.clientId,
    });
    this.restoreSession();
  }

  /** ページリロード時にCognitoセッションからトークンを復元する */
  private restoreSession(): void {
    const cognitoUser = this.userPool.getCurrentUser();
    if (!cognitoUser) {
      this.initializedSignal.set(true);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        this.tokenSignal.set(null);
      } else {
        this.tokenSignal.set(session.getIdToken().getJwtToken());
      }
      this.initializedSignal.set(true);
    });
  }

  /** Cognitoでメールアドレスとパスワードによるログインを行う
   * @param email - メールアドレス
   * @param password - パスワード
   * @returns 成功時は success: true、失敗時は error メッセージを含むオブジェクト
   */
  login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session: CognitoUserSession) => {
          this.tokenSignal.set(session.getIdToken().getJwtToken());
          resolve({ success: true });
        },
        onFailure: (err: Error) => {
          resolve({ success: false, error: err.message });
        },
      });
    });
  }

  /** Cognitoに新規ユーザーを登録する
   * @param email - メールアドレス
   * @param password - パスワード
   * @returns 成功時は success: true、失敗時は error メッセージを含むオブジェクト
   */
  signUp(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.userPool.signUp(email, password, [], [], (err, _result) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }
        resolve({ success: true });
      });
    });
  }

  /** メールで受け取った確認コードでアカウントを有効化する
   * @param email - メールアドレス
   * @param code - 確認コード
   * @returns 成功時は success: true、失敗時は error メッセージを含むオブジェクト
   */
  confirmSignUp(email: string, code: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.confirmRegistration(code, true, (err, _result) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }
        resolve({ success: true });
      });
    });
  }

  /** パスワードリセット用の確認コードをメールで送信する
   * @param email - メールアドレス
   * @returns 成功時は success: true、失敗時は error メッセージを含むオブジェクト
   */
  forgotPassword(email: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.forgotPassword({
        onSuccess: () => {
          resolve({ success: true });
        },
        onFailure: (err: Error) => {
          resolve({ success: false, error: err.message });
        },
      });
    });
  }

  /** パスワードリセット確認コードと新しいパスワードでパスワードを再設定する
   * @param email - メールアドレス
   * @param code - メールで受け取った確認コード
   * @param newPassword - 新しいパスワード
   * @returns 成功時は success: true、失敗時は error メッセージを含むオブジェクト
   */
  confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => {
          resolve({ success: true });
        },
        onFailure: (err: Error) => {
          resolve({ success: false, error: err.message });
        },
      });
    });
  }

  /** 確認コードを再送する
   * @param email - メールアドレス
   * @returns 成功時は success: true、失敗時は error メッセージを含むオブジェクト
   */
  resendConfirmationCode(email: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.resendConfirmationCode((err, _result) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }
        resolve({ success: true });
      });
    });
  }

  /** Cognitoからサインアウトしてトークンをクリアし、ログイン画面へ遷移する */
  logout(): void {
    const cognitoUser = this.userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    this.tokenSignal.set(null);
  }

  /** 現在のIDトークンを返す
   * @returns IDトークン文字列、未ログインの場合は null
   */
  getToken(): string | null {
    return this.tokenSignal();
  }

  /** Cognitoセッションから最新のIDトークンを取得する。
   * IDトークンが期限切れでもリフレッシュトークンが有効であれば自動更新される。
   * @returns 有効なIDトークン文字列、未ログイン・期限切れの場合は null
   */
  getFreshToken(): Promise<string | null> {
    return new Promise((resolve) => {
      const cognitoUser = this.userPool.getCurrentUser();
      if (!cognitoUser) {
        resolve(null);
        return;
      }
      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          this.tokenSignal.set(null);
          resolve(null);
          return;
        }
        const token = session.getIdToken().getJwtToken();
        this.tokenSignal.set(token);
        resolve(token);
      });
    });
  }
}
