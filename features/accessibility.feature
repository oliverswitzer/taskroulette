Feature: Accessibility baseline
  As a user with ADHD, some of whom also have visual or motor impairments
  I want the app to meet WCAG AA standards
  So that the tool is usable regardless of ability

  Scenario Outline: Every interactive control meets the minimum touch target size
    Given I am on the "<screen>" screen
    Then every tappable control is at least 44 by 44 pixels

    Examples:
      | screen     |
      | DUMP       |
      | LIST_EDIT  |
      | WHEEL_IDLE |
      | TASK_CARD  |
      | ALL_DONE   |

  Scenario Outline: Text meets minimum contrast ratio
    Given I am on the "<screen>" screen
    Then all body text has a contrast ratio of at least 4.5 to 1 against its background

    Examples:
      | screen     |
      | DUMP       |
      | LIST_EDIT  |
      | WHEEL_IDLE |
      | TASK_CARD  |
      | ALL_DONE   |

  Scenario: Reduced motion preference disables non-essential animation
    Given the OS "reduce motion" accessibility setting is enabled
    When I navigate between any two screens
    Then the transition uses a crossfade or instant change instead of a sliding animation
