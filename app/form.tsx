'use client';
import React, { FunctionComponent, useState } from "react";
import { useForm } from "react-hook-form";
import styles from "../styles/page.module.scss";

const ContactForm: FunctionComponent = () => {
  interface IContactForm {
    organization?: string;
    name: string;
    email: string;
    message: string;
    website?: string; // スパム対策のための隠しフィールド
  }

  const { register, handleSubmit, getValues, setValue, reset, formState: { errors } } = useForm<IContactForm>();
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState<string>("");

  const onFormInput = (event: React.FormEvent<HTMLInputElement|HTMLTextAreaElement>) => {
    const dummy = event.currentTarget.parentNode?.querySelector('.dummy');
    if (dummy) {
      dummy.textContent = event.currentTarget.value + '\u200b';
    }
  };

  const onFormSubmit = handleSubmit(async data => {
    const form = document.querySelector<HTMLFormElement>('#contact-form');
    const message = document.querySelector<HTMLParagraphElement>('#contact-form-message');
    const resetButton = document.querySelector<HTMLButtonElement>('#contact-form-reset');
    const submitButton = form?.querySelector<HTMLButtonElement>('button[type=submit]');

    if (!form || !message || !resetButton || !submitButton) {
      console.error('Element not found or unexpected type.', 
        'form:', form, 'message:', message, 'resetButton:', resetButton, 'submitButton:', submitButton);
      return;
    }

    setErrorText("");

    switch(form.dataset.state) {
      case 'input':
        message.textContent = "上記の内容で送信しますか？";
        resetButton.textContent = "戻る";
        submitButton.textContent = "送信する";
        form.dataset.state = 'confirm';
        break;

      case 'confirm':
        // スパム対策のための隠しフィールドに値が入っていたら送信しない
        if (data.website && data.website.trim() !== "") {
          setErrorText("送信に失敗しました。再度お試しください。");
          break;
        }

        try {
          setSending(true);
          submitButton.disabled = true;

          // 15秒タイムアウト
          const ac = new AbortController();
          const timeout = setTimeout(() => ac.abort(), 15000);
          
          const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              organization: data.organization ?? '',
              name: data.name,
              email: data.email,
              message: data.message,
            }),
            signal: ac.signal
          });
          clearTimeout(timeout);

          if (!response.ok) {
            const j = await response.json().catch(() => ({}));
            throw new Error(j?.error || `HTTP error! status: ${response.status}`);
          }

          message.textContent = "送信しました。";
          resetButton.textContent = "リセット";
          submitButton.textContent = "戻る";
          form.dataset.state = 'sent';

        } catch (error: any) {
          setErrorText(`送信に失敗しました: ${error?.message ?? 'unknown error'}`);
          message.textContent = "送信に失敗しました。再度お試しください。";
          form.dataset.state = 'confirm';
        
        } finally {
          setSending(false);
          submitButton.disabled = false;
        }

        break;

      case 'sent':
        reset();      // react-hook-formの状態初期化
        form.reset(); // DOM側の状態初期化
        message.textContent = "";
        resetButton.textContent = "リセット";
        submitButton.textContent = "送信する";
        form.dataset.state = 'input';
        break;
    }
    console.log("message.textContent", message.textContent)

    return;
  });

  const onFormReset = () => {
    const form = document.querySelector<HTMLFormElement>('#contact-form');
    const message = document.querySelector<HTMLParagraphElement>('#contact-form-message');
    const resetButton = document.querySelector<HTMLButtonElement>('#contact-form-reset');
    const submitButton = form?.querySelector<HTMLButtonElement>('button[type=submit]');

    if (!form || !message || !resetButton || !submitButton) {
      console.error('Element not found or unexpected type.', 
        'form:', form, 'message:', message, 'resetButton:', resetButton, 'submitButton:', submitButton);
      return;
    }

    // state が confirm のときはフォームデータをdummyから戻す. それ以外ならリセット.
    const state = form.dataset.state;
    if (state === 'confirm') {
      const values = getValues();
      setValue('organization', values.organization);
      setValue('name', values.name);
      setValue('email', values.email);
      setValue('message', values.message);
    }
    else {
      reset();
    }

    message.textContent = "";
    resetButton.textContent = "リセット";
    submitButton.textContent = "送信する";
    form.dataset.state = 'input';

    return false;
  };

  return (
    <form id="contact-form" data-state="input" onSubmit={onFormSubmit} noValidate>
      <dl>
        <dt><label htmlFor="contact-form-data-organization">組織名<wbr/><small>(個人の場合は不要)</small></label></dt>
        <dd>
          <pre className="dummy"/>
          <input type="text" id="contact-form-data-organization" className={errors.organization ? " error" : undefined} 
            onInput={onFormInput}
            {...register("organization")} />
        </dd>
        <dt className={styles.required}><label htmlFor="contact-form-data-name">お名前</label></dt>
        <dd>
          <pre className="dummy"/>
          <input type="text" id="contact-form-data-name" className={errors.name ? " error" : undefined} 
            onInput={onFormInput}
            required
            {...register("name", { required: "内容を入力してください" })} />
          <p className={styles.errorMessage}>{errors.name?.message}</p>
        </dd>
        <dt className={styles.required}><label htmlFor="contact-form-data-email">e-mail</label></dt>
        <dd>
          <pre className="dummy"/>
          <input type="email" id="contact-form-data-email" className={errors.email ? " error" : undefined} 
            onInput={onFormInput}
            required
            {...register("email", { 
              required: "内容を入力してください",
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "メール形式が不正です" }
            })} />
          <p className={styles.errorMessage}>{errors.email?.message}</p>
        </dd>
        <dt className={styles.required}><label htmlFor="contact-form-data-message">メッセージ<wbr/><small style={{whiteSpace:"nowrap"}}>(改行可)</small></label></dt>
        <dd>
          <pre className="dummy"/>
          <textarea
            id="contact-form-data-message"
            className={errors.message ? " error" : undefined}
            onInput={onFormInput}
            {...register("message", { required: "内容を入力してください" })}
          />
          <p className={styles.errorMessage}>{errors.message?.message}</p>
        </dd>
        {/* ハニーポット（ユーザー非表示／CSSでdisplay:noneでもOK） */}
        <input
          type="text"
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: "absolute", left: "-10000px" }}
          {...register("website")}
        />
      </dl>
      <article className={styles.formAction}>
        <p className={styles.formMessage} id="contact-form-message"　aria-live="polite">
          {errorText && <span className={styles.errorMessage}>{errorText}</span>}
        </p>
        <button type="button" className={styles.reset} id="contact-form-reset" onClick={onFormReset} disabled={sending}>リセット</button>
        <button type="submit" className={styles.submit} id="contact-form-submit" disabled={sending}>
          {sending ? "送信中…" : "送信する"}
        </button>
      </article>
    </form>
  );
}
export default ContactForm;