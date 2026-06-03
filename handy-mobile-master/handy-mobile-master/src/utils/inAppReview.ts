import InAppReview from "react-native-in-app-review";
import { localStorage } from "./storage";

const REVIEW_KEY = "lastReviewPrompt";
const MIN_DAYS = 30;

export const requestReviewIfEligible = () => {
  if (!InAppReview.isAvailable()) return;

  const last = localStorage.getItem(REVIEW_KEY);
  if (last) {
    const daysSince = (Date.now() - Number(last)) / (1000 * 60 * 60 * 24);
    if (daysSince < MIN_DAYS) return;
  }

  localStorage.setItem(REVIEW_KEY, String(Date.now()));
  InAppReview.RequestInAppReview();
};
