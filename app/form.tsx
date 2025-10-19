"use client";
import React, { useState, useRef } from "react";
import {
  useForm,
  SubmitHandler,
  RegisterOptions,
  UseFormRegister,
  UseFormWatch,
  Path,
  FieldError,
} from "react-hook-form";
import styles from "../styles/page.module.scss";
import HCaptcha from "@hcaptcha/react-hcaptcha";

/** フォーム送信タイムアウト時間(ms) */
const SEND_TIMEOUT_MS = 15000;

/** フォーム入力項目インターフェイス */
interface IContactForm {
  organization?: string;
  name: string;
  email: string;
  message: string;
  website?: string; // スパム対策のための隠しフィールド
  hcaptcha?: string | null; // hCaptcha トークン
}

/** フォーム入力項目識別キー定義 */
const FieldKey = {
  organization: "organization",
  name: "name",
  email: "email",
  message: "message",
  website: "website",
  hcaptcha: "hcaptcha",
} as const satisfies Record<string, Path<IContactForm>>;
type FieldKey = (typeof FieldKey)[keyof typeof FieldKey];

/** 入力項目の属性インターフェイス */
interface IInputProps {
  fieldKey: FieldKey;
  label?: string;
  type: React.HTMLInputTypeAttribute | "textarea";
  sub?: string;
  placeholder?: string;
  required?: boolean;
  register: UseFormRegister<IContactForm>;
  error: FieldError | undefined;
  stage: Stage;
  watch: UseFormWatch<IContactForm>;
}

/** 問い合わせフォームレスポンスインターフェイス */
interface IAPIResponse {
  ok: boolean;
  type?: string;
  error?: string;
  details?: string[];
}

/** フォームのステージ定義 */
class Stage {
  private constructor(private readonly value: string) {}

  static readonly input = new Stage("input");
  static readonly confirm = new Stage("confirm");
  static readonly sent = new Stage("sent");
  static readonly failed = new Stage("failed");

  isInput(): boolean {
    return this === Stage.input;
  }

  isConfirm(): boolean {
    return this === Stage.confirm;
  }

  isSent(): boolean {
    return this === Stage.sent;
  }

  isFailed(): boolean {
    return this === Stage.failed;
  }

  toString(): string {
    return this.value;
  }
}

/** 入力コンポーネント */
const Input = ({
  fieldKey,
  label,
  type,
  sub,
  placeholder,
  required,
  register,
  error,
  stage,
  watch,
}: IInputProps) => {
  const registerOptions: RegisterOptions<IContactForm> = {};
  if (required) {
    registerOptions.required = "内容を入力してください";
  }
  if (type === "email") {
    registerOptions.pattern = {
      value:
        /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
      message: "メール形式が不正です",
    };
  }

  const registerProps = register(fieldKey, registerOptions);

  // input/textarea 共通 props
  const props = {
    id: `contact-form-data-${fieldKey}`,
    className: error ? "error" : undefined,
    placeholder: stage.isConfirm() ? "" : placeholder,
    required,
    tabIndex: stage.isConfirm() ? -1 : undefined,
    readOnly: stage.isConfirm(),
    ...registerProps,
  };

  return (
    <>
      <dt className={required ? styles.required : undefined}>
        <label htmlFor={`contact-form-data-${fieldKey}`}>
          {label || fieldKey}
          {sub && (
            <>
              <wbr />
              <small style={{ whiteSpace: "nowrap" }}>{sub}</small>
            </>
          )}
        </label>
      </dt>
      <dd>
        <pre className="dummy">
          {watch(fieldKey as keyof IContactForm) + "\u200b"}
        </pre>
        {type === "textarea" ? (
          <textarea {...props} />
        ) : (
          <input type={type} {...props} />
        )}
        <p className={styles.errorMessage}>{error?.message}</p>
      </dd>
    </>
  );
};

/**
 * ContactForm
 * - 入力 → 確認 → 送信 の 3 ステップフォーム
 * - クライアント側で hCaptcha を必須にし、送信時にトークンをサーバへ渡す
 * - サーバ側で hCaptcha トークンの検証を必ず行うこと（重要）
 */
export default function ContactForm(): React.JSX.Element {
  const nextPublicHCaptchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
    setValue,
    watch,
  } = useForm<IContactForm>({
    mode: "onBlur",
    reValidateMode: "onChange",
    criteriaMode: "all",
    defaultValues: {
      organization: "",
      name: "",
      email: "",
      message: "",
      website: "",
      hcaptcha: null,
    },
  });
  const [errorText, setErrorText] = useState<string[]>(
    nextPublicHCaptchaSiteKey
      ? []
      : [
          "CAPTCHAのサイトキーが未設定です。お手数ですが管理者(X(Twitter):@AyeBeeTY)まで連絡してください。",
        ]
  );
  const [stage, setStage] = useState<Stage>(Stage.input);

  const hcaptchaRef = useRef<HCaptcha | null>(null);
  // hcaptchaを必須項目として追加し、isValidの判定対象とする
  register(FieldKey.hcaptcha, { required: true });

  /** エラーテキストが1行でもあれば true */
  const hasErrorText = errorText && errorText.length > 0;

  /** CAPTCHAの入力をリセットする処理. */
  const resetCaptcha = () => {
    hcaptchaRef.current?.resetCaptcha();
    setValue(FieldKey.hcaptcha, null, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  /**
   * 送信ボタンの動作.
   * スパムチェックと hCaptcha チェックを行い, エラーなら何もしない.
   * - stage === Input（入力画面）: 確認画面へ移動
   * - stage === Confirm（確認画面）: 実送信
   * @param values フォームデータ
   */
  const onSubmit: SubmitHandler<IContactForm> = async (values) => {
    // スパム対策のための隠しフィールドに値が入っていたら送信しない
    if (values.website && values.website.trim() !== "") {
      setStage(Stage.failed);
      setErrorText(["送信に失敗しました。再度お試しください。"]);
      return;
    }

    // CAPTCHA未完了なら送信させない
    if (!values.hcaptcha) {
      setStage(Stage.failed);
      setErrorText(["人間による操作の確認（CAPTCHA）を完了してください。"]);
      return;
    }

    switch (stage) {
      case Stage.input:
        // 確認画面へ移動
        setErrorText([]);
        setStage(Stage.confirm);
        return;

      case Stage.confirm:
        let timeout: ReturnType<typeof setTimeout> | null = null;
        try {
          // 指定時間タイムアウト
          const ac = new AbortController();
          timeout = setTimeout(() => ac.abort(), SEND_TIMEOUT_MS);

          // 送信処理
          const response = await fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organization: values.organization ?? "",
              name: values.name,
              email: values.email,
              message: values.message,
              website: values.website ?? "",
              hcaptcha: values.hcaptcha ?? "",
            }),
            signal: ac.signal,
          });

          // 送信成功
          if (response.ok) {
            reset();
            setErrorText([]);
            setStage(Stage.sent);
          }
          // 送信失敗 → 確認画面のままエラー表示
          else {
            setStage(Stage.failed);

            const { ok, type, error, details }: IAPIResponse = await response
              .json()
              .catch(() => ({}));

            // 開発／運用向けに詳細はログに出力し、ユーザーには簡潔で正直な案内を出す
            console.error("contact API error:", response.status, {
              ok,
              type,
              error,
              details,
            });

            if (response.status >= 400 && response.status < 500) {
              if (type === "auto-response-email") {
                setErrorText([
                  "指定されたメールアドレスに応答メールが遅れなかったため、お問い合わせを受け付けられませんでした。",
                ]);
              } else {
                // バリデーション等はサーバのメッセージを利用できれば表示
                setErrorText([
                  error || "入力に誤りがあります。内容を確認してください。",
                ]);
              }
            } else {
              setErrorText([
                "送信に失敗しました（サーバーエラー）。時間をおいて再度お試しください。",
              ]);
            }
            return;
          }
        } catch (e: any) {
          setStage(Stage.failed);
          // 開発／運用向けに詳細はログに出力し、ユーザーには簡潔で正直な案内を出す
          console.error("contact send error:", e);

          if (e?.name === "AbortError") {
            setErrorText([
              "送信がタイムアウトしました。通信状況を確認してから再度お試しください。",
            ]);
          } else if (e?.name === "TypeError") {
            // fetch のネットワークエラー等
            setErrorText([
              "通信に失敗しました。通信が正常に行えるかご確認ください。",
            ]);
          } else {
            setErrorText([
              "送信中にエラーが発生しました。問題が続く場合は時間をおいて再度お試しください。",
            ]);
          }
        } finally {
          timeout && clearTimeout(timeout);
          // トークンは使い捨てなので毎回クリア。ただし UI を即時更新するためオプションを付ける
          resetCaptcha();
        }
        return;

      case Stage.sent:
      case Stage.failed:
      default:
      // 通常ここには来ないはず(送信ボタンがそもそもないので)
    }
  };

  /**
   * リセット/戻るボタンの動作.
   * - 確認画面のときは入力内容を復元
   * - 送信完了画面のときはフォームをリセット
   */
  const onReset = () => {
    switch (stage) {
      case Stage.input:
        reset();
        resetCaptcha();

        setErrorText([]);
        return;

      case Stage.confirm:
        setStage(Stage.input);
        reset(undefined, { keepValues: true });
        setValue(FieldKey.hcaptcha, null); // hCAPTCHAはリセットする
        return;

      case Stage.sent:
        // リセット/送信完了画面から再度送るときはフォームをリセット
        setStage(Stage.input);
        reset();
        return;

      case Stage.failed:
      default:
        setErrorText([]);
        setStage(Stage.input);
    }
  };

  return (
    <form
      id="contact-form"
      data-state={stage}
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <dl>
        <Input
          fieldKey={FieldKey.organization}
          label="組織名"
          type="text"
          sub="(個人の場合は不要)"
          placeholder="例）AyeBee Inc."
          register={register}
          error={errors.organization}
          stage={stage}
          watch={watch}
        />
        <Input
          fieldKey={FieldKey.name}
          label="お名前"
          type="text"
          placeholder="山田 太郎"
          required
          register={register}
          error={errors.name}
          stage={stage}
          watch={watch}
        />
        <Input
          fieldKey={FieldKey.email}
          label="メールアドレス"
          type="email"
          placeholder="taro@example.com"
          required
          register={register}
          error={errors.email}
          stage={stage}
          watch={watch}
        />
        <Input
          fieldKey={FieldKey.message}
          label="お問い合わせ内容"
          type="textarea"
          sub="(改行可)"
          required
          register={register}
          error={errors.message}
          stage={stage}
          watch={watch}
        />
      </dl>
      {
        /* ハニーポット（ユーザー非表示）とHCaptcha */
        stage.isInput() && (
          <>
            <input
              type="text"
              id="contact-form-data-website"
              className={errors.website ? "error" : undefined}
              autoComplete="off"
              tabIndex={-1}
              aria-hidden="true"
              style={{ position: "absolute", left: "-10000px" }}
              {...register(FieldKey.website)}
            />
            <div id="contact-form-data-captcha" className={styles.captcha}>
              {nextPublicHCaptchaSiteKey && (
                <HCaptcha
                  ref={hcaptchaRef}
                  sitekey={nextPublicHCaptchaSiteKey}
                  onVerify={(token) =>
                    setValue(FieldKey.hcaptcha, token ?? null, {
                      shouldValidate: true,
                      shouldDirty: true,
                      shouldTouch: true,
                    })
                  }
                  onExpire={() =>
                    setValue(FieldKey.hcaptcha, null, {
                      shouldValidate: true,
                      shouldDirty: true,
                      shouldTouch: true,
                    })
                  }
                />
              )}
            </div>
          </>
        )
      }
      <article className={styles.formAction}>
        <div
          className={
            styles.formMessage + (hasErrorText ? ` ${styles.error}` : "")
          }
          id="contact-form-message"
          aria-live="polite"
        >
          {hasErrorText ? (
            errorText.map((line, index) => (
              <p data-error-line={index}>{line}</p>
            ))
          ) : stage.isConfirm() ? (
            <p>上記の内容で送信しますか？</p>
          ) : stage.isSent() ? (
            <p>送信しました。</p>
          ) : undefined}
        </div>
        <button
          type="button"
          className={styles.reset}
          id="contact-form-reset"
          onClick={onReset}
          disabled={isSubmitting}
        >
          {stage.isInput() ? (
            <>リセット</>
          ) : stage.isConfirm() ? (
            <>戻って修正</>
          ) : (
            <>別の問い合わせを送る</>
          )}
        </button>
        <button
          type="submit"
          className={styles.submit}
          id="contact-form-submit"
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? (
            <>送信中…</>
          ) : stage.isInput() ? (
            <>入力確認</>
          ) : (
            <>送信する</>
          )}
        </button>
      </article>
    </form>
  );
}
