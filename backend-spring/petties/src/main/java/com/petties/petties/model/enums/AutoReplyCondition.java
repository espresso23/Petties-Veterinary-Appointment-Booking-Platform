package com.petties.petties.model.enums;

/**
 * Condition that controls when the away auto-reply should be sent.
 */
public enum AutoReplyCondition {
    /**
     * Only send away message when clinic is outside operating hours.
     */
    OFF_HOURS,

    /**
     * Always send away message whenever enabled, regardless of operating hours.
     */
    ALWAYS
}
