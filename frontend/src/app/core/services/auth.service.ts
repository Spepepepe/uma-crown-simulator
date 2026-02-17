import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenSignal = signal<string | null>(null);
  private userPool: CognitoUserPool;

  readonly token = this.tokenSignal.asReadonly();
  readonly isLoggedIn = computed(() => !!this.tokenSignal());

  constructor(private router: Router) {
    this.userPool = new CognitoUserPool({
      UserPoolId: environment.cognito.userPoolId,
      ClientId: environment.cognito.clientId,
    });
    this.restoreSession();
  }

  private restoreSession(): void {
    const cognitoUser = this.userPool.getCurrentUser();
    if (!cognitoUser) return;

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        this.tokenSignal.set(null);
        return;
      }
      this.tokenSignal.set(session.getIdToken().getJwtToken());
    });
  }

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

  logout(): void {
    const cognitoUser = this.userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    this.tokenSignal.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.tokenSignal();
  }
}
